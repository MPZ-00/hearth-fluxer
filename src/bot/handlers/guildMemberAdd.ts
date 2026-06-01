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

    // Verify this join used an invite that was issued for this specific user
    try {
        const freshInvites = await member.guild.invites.fetch()
        const usedCode = findConsumedInvite(member.guild.id, freshInvites)

        if (usedCode !== null) {
            const pending = db
                .select()
                .from(pendingInvites)
                .where(eq(pendingInvites.code, usedCode))
                .get()

            db.delete(pendingInvites)
                .where(eq(pendingInvites.code, usedCode))
                .run()

            if (!pending || pending.userId !== member.id) {
                logger.warn(
                    `Unauthorised join: member ${member.id}, invite ${usedCode ?? 'unknown'}`
                )
                await member.kick('hearth: join not authorised')
                return
            }
            logger.debug(
                `Verified join: member ${member.id} via invite ${usedCode}`
            )
        }
    } catch {
        // Insufficient permissions to fetch invites; allow the join
        logger.warn(
            `Could not verify invite for ${member.id} joining ${member.guild.id}`
        )
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
    const displayName =
        member.user?.displayName ?? member.user?.username ?? member.id
    await notifyCircle(member.client, member.id, displayName)
}
