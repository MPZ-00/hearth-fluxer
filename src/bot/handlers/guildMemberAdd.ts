import type { GuildMember } from 'discord.js'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { hearthGuilds, users, pendingInvites } from '../../db/schema'
import { addToCircle } from '../../services/whitelist'
import { notifyCircle } from '../../services/notification'
import { findConsumedInvite } from '../inviteCache'
import { logger } from '../../logger'

export async function handleGuildMemberAdd(member: GuildMember) {
    const isHearthGuild = db
        .select({ guildId: hearthGuilds.guildId })
        .from(hearthGuilds)
        .where(eq(hearthGuilds.guildId, member.guild.id))
        .get()

    if (!isHearthGuild) return

    // Look up the pending invite by userId first, then check if that specific code is gone.
    // This avoids the race condition: two simultaneous joins each look for their own DB row
    // rather than both comparing the same stale cache state.
    try {
        const userPending = db
            .select()
            .from(pendingInvites)
            .where(eq(pendingInvites.userId, member.id))
            .get()

        if (userPending) {
            const freshInvites = await member.guild.invites.fetch()
            findConsumedInvite(member.guild.id, freshInvites) // keep cache current
            const consumed = !freshInvites.has(userPending.code)
            db.delete(pendingInvites).where(eq(pendingInvites.code, userPending.code)).run()

            if (!consumed) {
                logger.warn(
                    `Unauthorised join: ${member.id} joined but pending invite ${userPending.code} is still live`,
                )
                await member.kick('hearth: join not authorised')
                return
            }
            logger.debug(`Verified join: ${member.id} via invite ${userPending.code}`)
        } else {
            // No pending invite ─ possible manual admin add. Log and allow.
            logger.warn(
                `No pending invite for joining member ${member.id} ─ allowing (possible manual add)`,
            )
        }
    } catch {
        logger.warn(`Could not verify invite for ${member.id} joining ${member.guild.id}`)
    }

    // Mutual whitelist: shared server membership is what makes presence visible in Discord.
    const existingUsers = db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.optedIn, true))
        .all()

    for (const { id } of existingUsers) {
        if (id === member.id || id === member.client.user!.id) continue
        addToCircle(member.id, id, 'guild_join')
        addToCircle(id, member.id, 'guild_join')
    }

    // Notify circle members: the user joined hearth = they're available to their circle
    const displayName = member.user?.displayName ?? member.user?.username ?? member.id
    await notifyCircle(member.client, member.id, displayName)
}
