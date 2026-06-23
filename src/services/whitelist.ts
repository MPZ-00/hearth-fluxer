import { eq, and, or } from 'drizzle-orm'
import type { Client } from 'discord.js'
import { db } from '../db/client'
import { users, whitelist, hearthGuilds } from '../db/schema'
import { upsertUser } from '../db/helpers'

export type WhitelistSource = 'command' | 'guild_join'

export function addToCircle(ownerId: string, memberId: string, source: WhitelistSource) {
    upsertUser(ownerId)
    upsertUser(memberId)
    if (source === 'command') {
        // Upgrade an existing guild_join entry to command-sourced so it survives guild departure.
        db.insert(whitelist)
            .values({ ownerId, memberId, source })
            .onConflictDoUpdate({
                target: [whitelist.ownerId, whitelist.memberId],
                set: { source: 'command' },
            })
            .run()
    } else {
        // Never downgrade a command entry to guild_join.
        db.insert(whitelist).values({ ownerId, memberId, source }).onConflictDoNothing().run()
    }
}

export function removeFromCircle(ownerId: string, memberId: string, source?: WhitelistSource) {
    if (source) {
        db.delete(whitelist)
            .where(
                and(
                    eq(whitelist.ownerId, ownerId),
                    eq(whitelist.memberId, memberId),
                    eq(whitelist.source, source),
                ),
            )
            .run()
    } else {
        db.delete(whitelist)
            .where(and(eq(whitelist.ownerId, ownerId), eq(whitelist.memberId, memberId)))
            .run()
    }
}

export function getCircle(ownerId: string) {
    return db.select().from(whitelist).where(eq(whitelist.ownerId, ownerId)).all()
}

export function isInCircle(ownerId: string, memberId: string): boolean {
    const row = db
        .select({ id: whitelist.id })
        .from(whitelist)
        .where(and(eq(whitelist.ownerId, ownerId), eq(whitelist.memberId, memberId)))
        .get()
    return row !== undefined
}

/**
 * Removes guild_join entries for memberId where the other party is no longer
 * co-located with them in any hearth guild (legacy shared guild or a claimed one).
 * Used when a member leaves a claimed guild, since they may still share another.
 */
export function pruneOrphanedGuildJoinEntries(client: Client, memberId: string) {
    const entries = db
        .select()
        .from(whitelist)
        .where(
            and(
                eq(whitelist.source, 'guild_join'),
                or(eq(whitelist.ownerId, memberId), eq(whitelist.memberId, memberId)),
            ),
        )
        .all()

    if (entries.length === 0) return

    const allGuildIds = db
        .select({ guildId: hearthGuilds.guildId })
        .from(hearthGuilds)
        .all()
        .map((g) => g.guildId)

    const stillCoLocated = (otherId: string) =>
        allGuildIds.some((guildId) => {
            const cache = client.guilds.cache.get(guildId)?.members.cache
            return cache?.has(memberId) && cache?.has(otherId)
        })

    for (const entry of entries) {
        const otherId = entry.ownerId === memberId ? entry.memberId : entry.ownerId
        if (!stillCoLocated(otherId)) {
            db.delete(whitelist)
                .where(
                    and(
                        eq(whitelist.ownerId, entry.ownerId),
                        eq(whitelist.memberId, entry.memberId),
                        eq(whitelist.source, 'guild_join'),
                    ),
                )
                .run()
        }
    }
}

/**
 * Returns users who have notify=true and explicitly added memberId via /add.
 * guild_join entries are excluded — auto-mutual connections don't imply notification consent.
 */
export function getNotifyWatchers(memberId: string) {
    return db
        .select({ ownerId: whitelist.ownerId })
        .from(whitelist)
        .innerJoin(users, eq(users.id, whitelist.ownerId))
        .where(
            and(
                eq(whitelist.memberId, memberId),
                eq(whitelist.source, 'command'),
                eq(users.notify, true),
            ),
        )
        .all()
}
