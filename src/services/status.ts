import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';
import type { Client } from 'discord.js';
import { config } from '../config';

function upsertUser(id: string) {
  db.insert(users).values({ id }).onConflictDoNothing().run();
}

export function getUser(id: string) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

/**
 * Sets opted_in status and, for the self-hosted mode, handles guild membership:
 * - on:  returns a one-time invite URL the command can forward to the user
 * - off: kicks the user from the hearth guild
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
    // Bots can't add users to guilds without their OAuth token; send an invite instead
    try {
      const channels = guild.channels.cache.filter((c) => c.isTextBased());
      const channel = channels.first();
      if (!channel) return {};
      const invite = await guild.invites.create(channel.id, {
        maxAge: 300,  // 5-minute window
        maxUses: 1,
        unique: true,
        reason: 'hearth /status on',
      });
      return { inviteUrl: invite.url };
    } catch {
      return {};
    }
  } else {
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
