import { eq, and, gt } from 'drizzle-orm'
import { db } from '../db/client'
import { users, pendingInvites } from '../db/schema'
import type { FluxerClient } from '../bot/client'
import { config } from '../config'
import { upsertUser, getUser } from '../db/helpers'
import { enqueueKick } from './kickQueue'

export { getUser }

// ASSUMED (Discord-parity, unverified): invite URL scheme, see PORTING.md
const inviteUrl = (code: string) => `https://fluxer.app/invite/${code}`

/**
 * Sets opted_in status and, for self-hosted mode, handles guild membership:
 * - on:  returns a one-time invite URL (reuses live pending invite if one exists)
 * - off: kicks the user and clears any pending invite
 */
export async function setOptedIn(
    client: FluxerClient,
    userId: string,
    optedIn: boolean,
): Promise<{ inviteUrl?: string }> {
    upsertUser(userId)
    db.update(users)
        .set({ optedIn, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(users.id, userId))
        .run()

    if (!config.HEARTH_GUILD_ID) return {}

    if (optedIn) {
        if (!config.HEARTH_INVITE_CHANNEL_ID) return {}
        const now = Math.floor(Date.now() / 1000)

        // Reuse an existing live invite rather than creating a new one on every call
        const existing = db
            .select()
            .from(pendingInvites)
            .where(and(eq(pendingInvites.userId, userId), gt(pendingInvites.expiresAt, now)))
            .get()

        if (existing) {
            return { inviteUrl: inviteUrl(existing.code) }
        }

        // Clear any expired record before creating a fresh invite
        db.delete(pendingInvites).where(eq(pendingInvites.userId, userId)).run()

        try {
            const invite = await client.rest.createChannelInvite(
                config.HEARTH_INVITE_CHANNEL_ID,
                { max_age: 300, max_uses: 1, unique: true },
                'hearth /status on',
            )

            // Bind the invite to this user so guildMemberAdd can verify the join
            db.insert(pendingInvites)
                .values({ code: invite.code, userId, expiresAt: now + 300 })
                .run()

            return { inviteUrl: inviteUrl(invite.code) }
        } catch {
            return {}
        }
    } else {
        db.delete(pendingInvites).where(eq(pendingInvites.userId, userId)).run()

        try {
            const exists = await client.rest.hasGuildMember(config.HEARTH_GUILD_ID, userId)
            if (exists)
                await client.rest.kickGuildMember(
                    config.HEARTH_GUILD_ID,
                    userId,
                    'hearth /status off',
                )
        } catch {
            await enqueueKick(client, userId, config.HEARTH_GUILD_ID, 'hearth /status off')
        }
        return {}
    }
}

export function setNotify(userId: string, notify: boolean) {
    upsertUser(userId)
    db.update(users)
        .set({ notify, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(users.id, userId))
        .run()
}
