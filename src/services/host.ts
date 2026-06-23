import { eq } from 'drizzle-orm'
import type { Client, Guild } from 'discord.js'
import { db } from '../db/client'
import { hearthGuilds } from '../db/schema'
import { pruneOrphanedGuildJoinEntries } from './whitelist'

export function isClaimed(guildId: string): boolean {
    return !!db
        .select({ guildId: hearthGuilds.guildId })
        .from(hearthGuilds)
        .where(eq(hearthGuilds.guildId, guildId))
        .get()
}

export function claimGuild(guildId: string): boolean {
    if (isClaimed(guildId)) return false
    db.insert(hearthGuilds).values({ guildId }).run()
    return true
}

export function unclaimGuild(client: Client, guild: Guild) {
    const memberIds = [...guild.members.cache.keys()]
    db.delete(hearthGuilds).where(eq(hearthGuilds.guildId, guild.id)).run()
    for (const memberId of memberIds) {
        pruneOrphanedGuildJoinEntries(client, memberId)
    }
}
