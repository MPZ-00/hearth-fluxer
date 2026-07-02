import type { FluxerClient } from '../client'
import type { GuildMemberAddDispatch } from '../../fluxer/types'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { hearthGuilds, users, pendingInvites } from '../../db/schema'
import { addToCircle } from '../../services/whitelist'
import { notifyCircle } from '../../services/notification'
import { enqueueKick } from '../../services/kickQueue'
import { updateInviteCache, hasInviteCode } from '../inviteCache'
import { logger } from '../../logger'
import { config } from '../../config'

// Bot-issued one-time invites need verifying against abuse; returns false if the
// join should be rejected (and kicks the member).
async function verifyLegacyJoin(
    client: FluxerClient,
    member: GuildMemberAddDispatch,
): Promise<boolean> {
    const userPending = db
        .select()
        .from(pendingInvites)
        .where(eq(pendingInvites.userId, member.user.id))
        .get()

    if (!userPending) {
        logger.warn(`No pending invite for ${member.user.id}, allowing possible manual add`)
        return true
    }

    let freshInvites
    try {
        freshInvites = await client.rest.listGuildInvites(member.guild_id)
    } catch {
        logger.warn(`Could not verify invite for ${member.user.id} joining ${member.guild_id}`)
        return false
    }

    updateInviteCache(member.guild_id, freshInvites)
    const consumed = !hasInviteCode(member.guild_id, userPending.code)
    db.delete(pendingInvites).where(eq(pendingInvites.code, userPending.code)).run()

    if (consumed) {
        logger.debug(`Verified join: ${member.user.id} via invite ${userPending.code}`)
        return true
    }

    logger.warn(`Unauthorised join: ${member.user.id} via still-live invite ${userPending.code}`)
    try {
        await client.rest.kickGuildMember(
            member.guild_id,
            member.user.id,
            'hearth: join not authorised',
        )
    } catch {
        await enqueueKick(client, member.user.id, member.guild_id, 'hearth: join not authorised')
    }
    return false
}

export async function handleGuildMemberAdd(client: FluxerClient, member: GuildMemberAddDispatch) {
    const hearthGuild = db
        .select({ guildId: hearthGuilds.guildId })
        .from(hearthGuilds)
        .where(eq(hearthGuilds.guildId, member.guild_id))
        .get()

    if (!hearthGuild) return

    // Claimed/auto-claimed guilds use the owner's own invites, so only the legacy shared guild needs verifying.
    if (member.guild_id === config.HEARTH_GUILD_ID) {
        const verified = await verifyLegacyJoin(client, member)
        if (!verified) return
    }

    // Scope the mutual whitelist to members actually present in this guild, so each
    // claimed guild stays its own isolated circle instead of one global pool.
    // No local member cache here, so co-location is checked per opted-in user over REST.
    const optedInUsers = db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.optedIn, true))
        .all()

    for (const { id } of optedInUsers) {
        if (id === member.user.id || id === client.userId) continue
        const present = await client.rest.hasGuildMember(member.guild_id, id)
        if (!present) continue
        addToCircle(member.user.id, id, 'guild_join')
        addToCircle(id, member.user.id, 'guild_join')
    }

    const displayName = member.user.global_name ?? member.user.username
    await notifyCircle(client, member.user.id, displayName)
}
