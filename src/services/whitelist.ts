import { eq, and } from 'drizzle-orm';
import { db } from '../db/client';
import { users, whitelist } from '../db/schema';

export type WhitelistSource = 'command' | 'guild_join';

function upsertUser(id: string) {
  db.insert(users).values({ id }).onConflictDoNothing().run();
}

export function addToCircle(ownerId: string, memberId: string, source: WhitelistSource) {
  upsertUser(ownerId);
  upsertUser(memberId);
  db.insert(whitelist)
    .values({ ownerId, memberId, source })
    .onConflictDoNothing()
    .run();
}

export function removeFromCircle(
  ownerId: string,
  memberId: string,
  source?: WhitelistSource,
) {
  if (source) {
    db.delete(whitelist)
      .where(
        and(
          eq(whitelist.ownerId, ownerId),
          eq(whitelist.memberId, memberId),
          eq(whitelist.source, source),
        ),
      )
      .run();
  } else {
    db.delete(whitelist)
      .where(and(eq(whitelist.ownerId, ownerId), eq(whitelist.memberId, memberId)))
      .run();
  }
}

export function getCircle(ownerId: string) {
  return db
    .select()
    .from(whitelist)
    .where(eq(whitelist.ownerId, ownerId))
    .all();
}

export function isInCircle(ownerId: string, memberId: string): boolean {
  const row = db
    .select({ id: whitelist.id })
    .from(whitelist)
    .where(and(eq(whitelist.ownerId, ownerId), eq(whitelist.memberId, memberId)))
    .get();
  return row !== undefined;
}

/** Returns all users who have notify=true and have memberId in their circle. */
export function getNotifyWatchers(memberId: string) {
  return db
    .select({ ownerId: whitelist.ownerId })
    .from(whitelist)
    .innerJoin(users, eq(users.id, whitelist.ownerId))
    .where(and(eq(whitelist.memberId, memberId), eq(users.notify, true)))
    .all();
}
