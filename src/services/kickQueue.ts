import type { FluxerClient } from '../bot/client'
import { eq, and, or } from 'drizzle-orm'
import { db } from '../db/client'
import { kickQueue, whitelist, users } from '../db/schema'
import { logger } from '../logger'
import { config } from '../config'

const MAX_ATTEMPTS = 5

async function notifyAdmin(client: FluxerClient, message: string): Promise<void> {
    if (!config.ADMIN_CHANNEL_ID) return
    try {
        await client.rest.sendMessage(config.ADMIN_CHANNEL_ID, message)
    } catch (err) {
        logger.error('Could not send admin alert:', err)
    }
}

export async function enqueueKick(
    client: FluxerClient,
    userId: string,
    guildId: string,
    reason: string,
): Promise<void> {
    db.insert(kickQueue).values({ userId, guildId, reason }).run()
    logger.warn(`Kick queued for ${userId}, bot may be missing Kick Members permission`)
    await notifyAdmin(
        client,
        `⚠️ Failed to kick <@${userId}> from the hearth guild.\n` +
            `They may still be visible to the circle. Queued for retry.\n` +
            `Check that the bot has the **Kick Members** permission, then run \`/dev queue-drain\`.`,
    )
}

function cleanupGhostUser(userId: string): void {
    db.delete(whitelist)
        .where(
            and(
                eq(whitelist.source, 'guild_join'),
                or(eq(whitelist.ownerId, userId), eq(whitelist.memberId, userId)),
            ),
        )
        .run()
    db.update(users)
        .set({ optedIn: false, updatedAt: Math.floor(Date.now() / 1000) })
        .where(and(eq(users.id, userId), eq(users.optedIn, true)))
        .run()
}

export async function drainKickQueue(
    client: FluxerClient,
): Promise<{ success: number; failed: number }> {
    const pending = db.select().from(kickQueue).all()
    if (pending.length === 0) return { success: 0, failed: 0 }

    let success = 0
    let failed = 0

    for (const entry of pending) {
        try {
            const exists = await client.rest.hasGuildMember(entry.guildId, entry.userId)

            if (!exists) {
                // Member already left; clean up the ghost state they left behind
                cleanupGhostUser(entry.userId)
                db.delete(kickQueue).where(eq(kickQueue.id, entry.id)).run()
                logger.info(`Kick queue: ${entry.userId} already gone, cleaned up ghost state`)
                success++
                continue
            }

            await client.rest.kickGuildMember(entry.guildId, entry.userId, entry.reason)
            db.delete(kickQueue).where(eq(kickQueue.id, entry.id)).run()
            logger.info(`Kick queue: kicked ${entry.userId}`)
            success++
        } catch {
            const newAttempts = entry.attempts + 1
            if (newAttempts >= MAX_ATTEMPTS) {
                db.delete(kickQueue).where(eq(kickQueue.id, entry.id)).run()
                logger.error(
                    `Kick queue: giving up on ${entry.userId} after ${MAX_ATTEMPTS} attempts, manual action required`,
                )
                await notifyAdmin(
                    client,
                    `🚨 Giving up on kicking <@${entry.userId}> after ${MAX_ATTEMPTS} failed attempts.\n` +
                        `The bot likely lacks **Kick Members** permission permanently. Please kick them manually.`,
                )
            } else {
                db.update(kickQueue)
                    .set({ attempts: newAttempts })
                    .where(eq(kickQueue.id, entry.id))
                    .run()
                logger.warn(
                    `Kick queue: retry failed for ${entry.userId} (attempt ${newAttempts}/${MAX_ATTEMPTS})`,
                )
                failed++
            }
        }
    }

    return { success, failed }
}
