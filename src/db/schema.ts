import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    optedIn: integer('opted_in', { mode: 'boolean' }).notNull().default(false),
    notify: integer('notify', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at')
        .notNull()
        .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at')
        .notNull()
        .default(sql`(unixepoch())`),
})

export const whitelist = sqliteTable(
    'whitelist',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        ownerId: text('owner_id')
            .notNull()
            .references(() => users.id),
        memberId: text('member_id')
            .notNull()
            .references(() => users.id),
        // tracks whether entry came from a command or automatic guild join
        source: text('source', { enum: ['command', 'guild_join'] })
            .notNull()
            .default('command'),
        addedAt: integer('added_at')
            .notNull()
            .default(sql`(unixepoch())`),
    },
    (table) => [
        uniqueIndex('whitelist_owner_member_unique').on(table.ownerId, table.memberId),
        index('idx_whitelist_owner').on(table.ownerId),
        index('idx_whitelist_member').on(table.memberId),
    ],
)

// One row per hearth guild. owner_id is null in self-hosted mode.
export const hearthGuilds = sqliteTable('hearth_guilds', {
    guildId: text('guild_id').primaryKey(),
    ownerId: text('owner_id'),
    addedAt: integer('added_at')
        .notNull()
        .default(sql`(unixepoch())`),
})

// Deduplicates presence notifications; only fires on actual status transitions.
export const presenceCache = sqliteTable('presence_cache', {
    userId: text('user_id')
        .primaryKey()
        .references(() => users.id),
    status: text('status', { enum: ['online', 'idle', 'dnd', 'offline'] }).notNull(),
    updatedAt: integer('updated_at')
        .notNull()
        .default(sql`(unixepoch())`),
})

// Binds a pending hearth-guild invite to the user who requested it.
export const pendingInvites = sqliteTable('pending_invites', {
    code: text('code').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id),
    expiresAt: integer('expires_at').notNull(),
})

// Kicks that failed due to missing bot permissions; retried on next drain.
export const kickQueue = sqliteTable('kick_queue', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull(),
    guildId: text('guild_id').notNull(),
    reason: text('reason').notNull().default('hearth /status off'),
    queuedAt: integer('queued_at')
        .notNull()
        .default(sql`(unixepoch())`),
    attempts: integer('attempts').notNull().default(0),
})
