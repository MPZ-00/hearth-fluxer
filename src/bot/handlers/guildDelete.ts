import type { FluxerClient } from '../client'
import type { GuildDispatch } from '../../fluxer/types'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { hearthGuilds } from '../../db/schema'
import { pruneOrphanedGuildJoinEntries } from '../../services/whitelist'
import { config } from '../../config'

export async function handleGuildDelete(client: FluxerClient, guild: GuildDispatch) {
    if (guild.id === config.HEARTH_GUILD_ID) return

    const claim = db.select().from(hearthGuilds).where(eq(hearthGuilds.guildId, guild.id)).get()
    if (!claim) return

    // If the bot itself was removed from the guild, this list call will fail,
    // so pruning is best-effort in that case (see PORTING.md).
    const members = await client.rest.listGuildMembers(guild.id).catch(() => [])
    db.delete(hearthGuilds).where(eq(hearthGuilds.guildId, guild.id)).run()
    for (const member of members) {
        await pruneOrphanedGuildJoinEntries(client, member.user.id)
    }
}
