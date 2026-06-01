import type { Client } from 'discord.js'
import { getNotifyWatchers } from './whitelist'
import { logger } from '../logger'

export async function notifyCircle(client: Client, userId: string, displayName: string) {
    const watchers = getNotifyWatchers(userId)
    if (watchers.length === 0) return

    logger.debug(`notifyCircle: sending to ${watchers.length} watcher(s) for ${displayName}`)

    await Promise.allSettled(
        watchers.map(async ({ ownerId }) => {
            try {
                const user = await client.users.fetch(ownerId)
                await user.send(`✶ \`${displayName}\` is here for you.`)
                logger.debug(`notifyCircle: DM sent to ${user.tag}`)
            } catch (err) {
                logger.warn(`notifyCircle: DM failed for ${ownerId}:`, err)
            }
        }),
    )
}
