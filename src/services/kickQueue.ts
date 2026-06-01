import type { Client } from 'discord.js'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { kickQueue } from '../db/schema'
import { logger } from '../logger'
import { config } from '../config'

export async function enqueueKick(
    client: Client,
    userId: string,
    guildId: string,
    reason: string,
): Promise<void> {
    db.insert(kickQueue).values({ userId, guildId, reason }).run()
    logger.warn(`Kick queued for ${userId} — bot may be missing Kick Members permission`)

    if (config.ADMIN_CHANNEL_ID) {
        try {
            const ch = await client.channels.fetch(config.ADMIN_CHANNEL_ID)
            if (ch?.isTextBased()) {
                await ch.send(
                    `⚠️ Failed to kick <@${userId}> from the hearth guild.\n` +
                        `They may still be visible to the circle. Queued for retry.\n` +
                        `Check that the bot has the **Kick Members** permission, then run \`/dev queue drain\`.`,
                )
            }
        } catch (err) {
            logger.error('Could not send admin alert:', err)
        }
    }
}

export async function drainKickQueue(client: Client): Promise<{ success: number; failed: number }> {
    const pending = db.select().from(kickQueue).all()
    if (pending.length === 0) return { success: 0, failed: 0 }

    let success = 0
    let failed = 0

    for (const entry of pending) {
        const guild = client.guilds.cache.get(entry.guildId)
        if (!guild) {
            failed++
            continue
        }
        try {
            const member = await guild.members.fetch(entry.userId).catch(() => null)
            if (member) await member.kick(entry.reason)
            db.delete(kickQueue).where(eq(kickQueue.id, entry.id)).run()
            logger.info(`Kick queue: removed ${entry.userId}`)
            success++
        } catch {
            db.update(kickQueue)
                .set({ attempts: entry.attempts + 1 })
                .where(eq(kickQueue.id, entry.id))
                .run()
            logger.warn(
                `Kick queue: retry failed for ${entry.userId} (attempt ${entry.attempts + 1})`,
            )
            failed++
        }
    }

    return { success, failed }
}
