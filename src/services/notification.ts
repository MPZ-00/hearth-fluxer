import type { FluxerClient } from '../bot/client'
import { getNotifyWatchers } from './whitelist'
import { logger } from '../logger'

// ASSUMED (Discord-parity, unverified): DM channel creation + message send shapes, see PORTING.md
export async function notifyCircle(client: FluxerClient, userId: string, displayName: string) {
    const watchers = getNotifyWatchers(userId)
    if (watchers.length === 0) return

    logger.debug(`notifyCircle: sending to ${watchers.length} watcher(s) for ${displayName}`)

    await Promise.allSettled(
        watchers.map(async ({ ownerId }) => {
            try {
                const dm = await client.rest.createDM(ownerId)
                await client.rest.sendMessage(dm.id, `✶ \`${displayName}\` is here for you.`)
                logger.debug(`notifyCircle: DM sent to ${ownerId}`)
            } catch (err) {
                logger.warn(`notifyCircle: DM failed for ${ownerId}:`, err)
            }
        }),
    )
}
