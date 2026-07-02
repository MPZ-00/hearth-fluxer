import type { FluxerClient } from './client'
import { logger } from '../logger'

const observers = new Set<string>()

export async function initObserverCache(
    client: FluxerClient,
    guildId: string,
    roleName: string,
): Promise<void> {
    if (!guildId) return
    try {
        // Members carry role IDs, not names, so resolve the target role ID first.
        const roles = await client.rest.listGuildRoles(guildId)
        const role = roles.find((r) => r.name.toLowerCase() === roleName.toLowerCase())
        if (!role) {
            logger.warn(`Observer cache: no role named "${roleName}" in guild ${guildId}`)
            observers.clear()
            return
        }

        const members = await client.rest.listGuildMembers(guildId)
        observers.clear()
        for (const member of members) {
            if (member.roles.includes(role.id)) observers.add(member.user.id)
        }
        logger.info(`Observer cache: ${observers.size} user(s) with role "${roleName}"`)
        for (const id of observers) {
            const member = members.find((m) => m.user.id === id)
            logger.debug(`  observer: ${member?.user.username ?? id}`)
        }
    } catch (err) {
        logger.warn('Observer cache: could not fetch members:', err)
    }
}

export function isObserver(userId: string): boolean {
    return observers.has(userId)
}
