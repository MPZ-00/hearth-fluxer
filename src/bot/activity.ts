import type { FluxerClient } from './client'
import { BOT_VERSION } from '../version'
import { config } from '../config'
import { logger } from '../logger'

const ROTATION_INTERVAL_MS = 10 * 60 * 1000

// Activity type numbers assumed Discord-parity (0 Playing, 2 Listening, 3 Watching), unverified.
function buildVariants(): { name: string; type: number }[] {
    const variants: { name: string; type: number }[] = [
        { name: BOT_VERSION, type: 0 },
        { name: 'for your circle', type: 3 },
        { name: '/help', type: 2 },
    ]
    if (config.SUPPORT_SERVER_URL) {
        variants.push({ name: 'the support server | /help', type: 3 })
    }
    return variants
}

// Reasserts the bot's activity on a timer and on every reconnect, so a flaky
// connection never leaves it stuck with no status until the process restarts.
export function startActivityRotation(client: FluxerClient) {
    const variants = buildVariants()
    let index = 0

    const apply = () => {
        const variant = variants[index % variants.length]
        client.gateway.setPresence(variant)
        index++
    }

    client.gateway.on('READY', apply)
    client.gateway.on('RESUMED', apply)
    setInterval(apply, ROTATION_INTERVAL_MS)

    logger.debug(
        `Activity rotation started: ${variants.length} variant(s) every ${ROTATION_INTERVAL_MS / 60_000}min`,
    )
}
