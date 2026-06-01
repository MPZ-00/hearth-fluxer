import type { Client } from 'discord.js'
import { logger } from '../logger'

const observers = new Set<string>()

export async function initObserverCache(
    client: Client,
    guildId: string,
    roleName: string,
): Promise<void> {
    if (!guildId) return
    const guild = client.guilds.cache.get(guildId)
    if (!guild) {
        logger.warn(`Observer cache: guild ${guildId} not in cache`)
        return
    }
    try {
        const members = await guild.members.fetch()
        for (const [, member] of members) {
            if (member.roles.cache.some((r) => r.name.toLowerCase() === roleName.toLowerCase())) {
                observers.add(member.id)
            }
        }
        logger.info(`Observer cache: ${observers.size} user(s) with role "${roleName}"`)
        for (const id of observers) {
            const member = guild.members.cache.get(id)
            logger.debug(`  observer: ${member?.user.tag ?? id}`)
        }
    } catch (err) {
        logger.warn('Observer cache: could not fetch members:', err)
    }
}

export function isObserver(userId: string): boolean {
    return observers.has(userId)
}
