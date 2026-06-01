import type { Presence } from 'discord.js';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { presenceCache, users } from '../../db/schema';
import { notifyCircle } from '../../services/notification';

type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';

export async function handlePresenceUpdate(oldPresence: Presence | null, newPresence: Presence) {
  const userId = newPresence.userId;
  const newStatus = (newPresence.status ?? 'offline') as PresenceStatus;

  // Only care about users who have opted in
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user?.optedIn) return;

  const cached = db
    .select()
    .from(presenceCache)
    .where(eq(presenceCache.userId, userId))
    .get();

  const oldStatus = (cached?.status ?? oldPresence?.status ?? 'offline') as PresenceStatus;

  // Update cache regardless of whether we notify
  db.insert(presenceCache)
    .values({ userId, status: newStatus, updatedAt: Math.floor(Date.now() / 1000) })
    .onConflictDoUpdate({
      target: presenceCache.userId,
      set: { status: newStatus, updatedAt: Math.floor(Date.now() / 1000) },
    })
    .run();

  // Notify circle watchers only on offline-to-online transition
  if (oldStatus === 'offline' && newStatus === 'online') {
    const displayName = newPresence.user?.displayName ?? userId;
    await notifyCircle(newPresence.client, userId, displayName);
  }
}
