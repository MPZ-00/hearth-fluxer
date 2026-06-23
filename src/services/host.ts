import { eq } from 'drizzle-orm'
import type { Client, Guild } from 'discord.js'
import { db } from '../db/client'
import { hearthGuilds } from '../db/schema'
import { pruneOrphanedGuildJoinEntries } from './whitelist'

export type ClaimResult =
    | { status: 'claimed' }
    | { status: 'already-claimed-by-you' }
    | { status: 'already-claimed-by-other' }

export function claimGuild(guildId: string, ownerId: string): ClaimResult {
    const existing = db.select().from(hearthGuilds).where(eq(hearthGuilds.guildId, guildId)).get()

    if (existing) {
        return existing.ownerId === ownerId
            ? { status: 'already-claimed-by-you' }
            : { status: 'already-claimed-by-other' }
    }

    db.insert(hearthGuilds).values({ guildId, ownerId }).run()
    return { status: 'claimed' }
}

export function getClaim(guildId: string) {
    return db.select().from(hearthGuilds).where(eq(hearthGuilds.guildId, guildId)).get()
}

export function unclaimGuild(client: Client, guild: Guild) {
    const memberIds = [...guild.members.cache.keys()]
    db.delete(hearthGuilds).where(eq(hearthGuilds.guildId, guild.id)).run()
    for (const memberId of memberIds) {
        pruneOrphanedGuildJoinEntries(client, memberId)
    }
}
