import type { FluxerClient } from '../client'
import type { PresenceUpdateDispatch } from '../../fluxer/types'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { presenceCache, users } from '../../db/schema'
import { notifyCircle } from '../../services/notification'
import { getNotifyWatchers } from '../../services/whitelist'
import { isObserver } from '../observerCache'
import { logger } from '../../logger'

type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline'

export async function handlePresenceUpdate(client: FluxerClient, presence: PresenceUpdateDispatch) {
    const userId = presence.user.id
    const newStatus = (presence.status ?? 'offline') as PresenceStatus

    const user = db.select().from(users).where(eq(users.id, userId)).get()

    const cached = db.select().from(presenceCache).where(eq(presenceCache.userId, userId)).get()
    const oldStatus = (cached?.status ?? 'offline') as PresenceStatus

    if (isObserver(userId)) {
        const watchers = user?.optedIn ? getNotifyWatchers(userId).length : 0
        logger.debug(
            `presence [${userId}] ${oldStatus} → ${newStatus}` +
                ` | opted_in=${user?.optedIn ?? false}` +
                ` | notify_watchers=${watchers}` +
                ` | will_notify=${user?.optedIn && oldStatus === 'offline' && newStatus === 'online'}`,
        )
    }

    if (!user?.optedIn) return

    // Update cache regardless of whether we notify
    db.insert(presenceCache)
        .values({
            userId,
            status: newStatus,
            updatedAt: Math.floor(Date.now() / 1000),
        })
        .onConflictDoUpdate({
            target: presenceCache.userId,
            set: { status: newStatus, updatedAt: Math.floor(Date.now() / 1000) },
        })
        .run()

    // Notify circle watchers only on offline-to-online transition
    if (oldStatus === 'offline' && newStatus === 'online') {
        // No cached display name from the presence payload alone, so fall back to REST.
        const fetchedUser = await client.rest.getUser(userId).catch(() => null)
        const displayName = fetchedUser?.global_name ?? fetchedUser?.username ?? userId
        await notifyCircle(client, userId, displayName)
    }
}
