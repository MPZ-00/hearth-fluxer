import type { Client, Collection, Invite } from 'discord.js'

// Per-guild: code -> uses count.
const cache = new Map<string, Map<string, number>>()

export async function initInviteCache(client: Client, guildId: string): Promise<void> {
    const guild = client.guilds.cache.get(guildId)
    if (!guild) return
    try {
        const invites = await guild.invites.fetch()
        cache.set(guildId, new Map(invites.map((inv) => [inv.code, inv.uses ?? 0])))
    } catch {
        // Missing Manage Guild permission or other error; cache stays empty
    }
}

export function trackInviteCreate(guildId: string, code: string): void {
    const guildCache = cache.get(guildId)
    if (guildCache) guildCache.set(code, 0)
}

export function removeFromCache(guildId: string, code: string): void {
    cache.get(guildId)?.delete(code)
}

/** Replaces the cached invite state for a guild with the freshly-fetched list. */
export function updateInviteCache(guildId: string, freshInvites: Collection<string, Invite>): void {
    cache.set(guildId, new Map(freshInvites.map((inv) => [inv.code, inv.uses ?? 0])))
}
