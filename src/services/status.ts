import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/client';
import { users, pendingInvites } from '../db/schema';
import type { Client } from 'discord.js';
import { config } from '../config';

function upsertUser(id: string) {
  db.insert(users).values({ id }).onConflictDoNothing().run();
}

export function getUser(id: string) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

/**
 * Sets opted_in status and, for self-hosted mode, handles guild membership:
 * - on:  returns a one-time invite URL (reuses live pending invite if one exists)
 * - off: kicks the user and clears any pending invite
 */
export async function setOptedIn(
  client: Client,
  userId: string,
  optedIn: boolean,
): Promise<{ inviteUrl?: string }> {
  upsertUser(userId);
  db.update(users)
    .set({ optedIn, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(users.id, userId))
    .run();

  if (!config.HEARTH_GUILD_ID) return {};

  const guild = client.guilds.cache.get(config.HEARTH_GUILD_ID);
  if (!guild) return {};

  if (optedIn) {
    const now = Math.floor(Date.now() / 1000);

    // Reuse an existing live invite rather than creating a new one on every call
    const existing = db
      .select()
      .from(pendingInvites)
      .where(and(eq(pendingInvites.userId, userId), gt(pendingInvites.expiresAt, now)))
      .get();

    if (existing) {
      return { inviteUrl: `https://discord.gg/${existing.code}` };
    }

    // Clear any expired record before creating a fresh invite
    db.delete(pendingInvites).where(eq(pendingInvites.userId, userId)).run();

    try {
      const channels = guild.channels.cache.filter((c) => c.isTextBased());
      const channel = channels.first();
      if (!channel) return {};
      const invite = await guild.invites.create(channel.id, {
        maxAge: 300,
        maxUses: 1,
        unique: true,
        reason: 'hearth /status on',
      });

      // Bind the invite to this user so guildMemberAdd can verify the join
      db.insert(pendingInvites)
        .values({ code: invite.code, userId, expiresAt: now + 300 })
        .run();

      return { inviteUrl: invite.url };
    } catch {
      return {};
    }
  } else {
    db.delete(pendingInvites).where(eq(pendingInvites.userId, userId)).run();

    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) await member.kick('hearth /status off');
    } catch {
      // Member may already be gone
    }
    return {};
  }
}

export function setNotify(userId: string, notify: boolean) {
  upsertUser(userId);
  db.update(users)
    .set({ notify, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(users.id, userId))
    .run();
}
