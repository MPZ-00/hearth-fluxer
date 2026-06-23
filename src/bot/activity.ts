import { ActivityType, Events, type Client } from 'discord.js'
import { BOT_VERSION } from '../version'
import { config } from '../config'
import { logger } from '../logger'

const ROTATION_INTERVAL_MS = 10 * 60 * 1000

function buildVariants(): { name: string; type: ActivityType }[] {
    const variants: { name: string; type: ActivityType }[] = [
        { name: BOT_VERSION, type: ActivityType.Playing },
        { name: 'for your circle', type: ActivityType.Watching },
        { name: '/help', type: ActivityType.Listening },
    ]
    if (config.SUPPORT_SERVER_URL) {
        variants.push({ name: 'the support server | /help', type: ActivityType.Watching })
    }
    return variants
}

// Reasserts the bot's activity on a timer and on every reconnect, so a flaky
// connection never leaves it stuck with no status until the process restarts.
export function startActivityRotation(client: Client) {
    const variants = buildVariants()
    let index = 0

    const apply = () => {
        if (!client.user) return
        const variant = variants[index % variants.length]
        client.user.setActivity(variant.name, { type: variant.type })
        index++
    }

    client.on(Events.ClientReady, apply)
    client.on(Events.ShardResume, apply)
    setInterval(apply, ROTATION_INTERVAL_MS)

    logger.debug(
        `Activity rotation started: ${variants.length} variant(s) every ${ROTATION_INTERVAL_MS / 60_000}min`,
    )
}
