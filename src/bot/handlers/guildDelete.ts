import type { Guild } from 'discord.js'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { hearthGuilds } from '../../db/schema'
import { pruneOrphanedGuildJoinEntries } from '../../services/whitelist'
import { config } from '../../config'

export function handleGuildDelete(guild: Guild) {
    if (guild.id === config.HEARTH_GUILD_ID) return

    const claim = db.select().from(hearthGuilds).where(eq(hearthGuilds.guildId, guild.id)).get()
    if (!claim) return

    const memberIds = [...guild.members.cache.keys()]
    db.delete(hearthGuilds).where(eq(hearthGuilds.guildId, guild.id)).run()
    for (const memberId of memberIds) {
        pruneOrphanedGuildJoinEntries(guild.client, memberId)
    }
}
