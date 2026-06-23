import type { GuildMember } from 'discord.js'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { hearthGuilds, users, pendingInvites } from '../../db/schema'
import { addToCircle } from '../../services/whitelist'
import { notifyCircle } from '../../services/notification'
import { enqueueKick } from '../../services/kickQueue'
import { updateInviteCache } from '../inviteCache'
import { logger } from '../../logger'
import { config } from '../../config'

// Bot-issued one-time invites need verifying against abuse; returns false if the
// join should be rejected (and kicks the member).
async function verifyLegacyJoin(member: GuildMember): Promise<boolean> {
    const userPending = db
        .select()
        .from(pendingInvites)
        .where(eq(pendingInvites.userId, member.id))
        .get()

    if (!userPending) {
        logger.warn(`No pending invite for ${member.id}, allowing possible manual add`)
        return true
    }

    let freshInvites
    try {
        freshInvites = await member.guild.invites.fetch()
    } catch {
        logger.warn(`Could not verify invite for ${member.id} joining ${member.guild.id}`)
        return false
    }

    updateInviteCache(member.guild.id, freshInvites)
    const consumed = !freshInvites.has(userPending.code)
    db.delete(pendingInvites).where(eq(pendingInvites.code, userPending.code)).run()

    if (consumed) {
        logger.debug(`Verified join: ${member.id} via invite ${userPending.code}`)
        return true
    }

    logger.warn(`Unauthorised join: ${member.id} via still-live invite ${userPending.code}`)
    try {
        await member.kick('hearth: join not authorised')
    } catch {
        await enqueueKick(member.client, member.id, member.guild.id, 'hearth: join not authorised')
    }
    return false
}

export async function handleGuildMemberAdd(member: GuildMember) {
    const hearthGuild = db
        .select({ guildId: hearthGuilds.guildId })
        .from(hearthGuilds)
        .where(eq(hearthGuilds.guildId, member.guild.id))
        .get()

    if (!hearthGuild) return

    // Claimed/auto-claimed guilds use the owner's own invites, so only the legacy shared guild needs verifying.
    if (member.guild.id === config.HEARTH_GUILD_ID) {
        const verified = await verifyLegacyJoin(member)
        if (!verified) return
    }

    // Scope the mutual whitelist to members actually present in this guild, so each
    // claimed guild stays its own isolated circle instead of one global pool.
    await member.guild.members.fetch()
    const optedInUsers = db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.optedIn, true))
        .all()

    for (const { id } of optedInUsers) {
        if (id === member.id || id === member.client.user!.id) continue
        if (!member.guild.members.cache.has(id)) continue
        addToCircle(member.id, id, 'guild_join')
        addToCircle(id, member.id, 'guild_join')
    }

    const displayName = member.user?.displayName ?? member.user?.username ?? `<@${member.id}>`
    await notifyCircle(member.client, member.id, displayName)
}
