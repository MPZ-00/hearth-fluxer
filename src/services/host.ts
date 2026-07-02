import { eq } from 'drizzle-orm'
import type { FluxerClient } from '../bot/client'
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

export async function unclaimGuild(client: FluxerClient, guildId: string) {
    const members = await client.rest.listGuildMembers(guildId).catch(() => [])
    const memberIds = members.map((m) => m.user.id)
    db.delete(hearthGuilds).where(eq(hearthGuilds.guildId, guildId)).run()
    for (const memberId of memberIds) {
        await pruneOrphanedGuildJoinEntries(client, memberId)
    }
}
