import type { FluxerClient } from '../client'
import { logger } from '../../logger'
import { config } from '../../config'
import { BOT_VERSION, REPO_URL } from '../../version'

// TODO: Fluxer has no slash-command/interaction system yet (confirmed: no ApplicationCommand
// or InteractionType anywhere in fluxerapp/fluxer, as of this port), though one is reportedly
// coming. The 7 hearth commands (status, add, remove, list, notify, host, help) are parked in
// src/commands/*.ts and need either a prefix-command rewrite here, or an in-place adaptation
// once Fluxer's own command API ships. See PORTING.md.

const PREFIX = '!'

// Mention syntax matches Discord's, confirmed in PORTING.md.
const MENTION_RE = /<@!?(\d+)>/g

interface MessageCreateDispatch {
    id: string
    channel_id: string
    guild_id?: string
    author: { id: string; bot?: boolean }
    content: string
}

function mentionsBot(content: string, botId: string): boolean {
    return new RegExp(`<@!?${botId}>`).test(content)
}

function stripMentions(content: string): string {
    return content.replace(MENTION_RE, '').trim()
}

function buildHelpMessage(): string {
    const lines = [
        `**hearth** ${BOT_VERSION}`,
        'You appear online only to the people you choose. Everyone else sees you offline.',
        '',
        `Source: ${REPO_URL}`,
    ]
    if (config.SUPPORT_SERVER_URL) lines.push(`Support: ${config.SUPPORT_SERVER_URL}`)
    return lines.join('\n')
}

export async function handleMessageCreate(client: FluxerClient, message: MessageCreateDispatch) {
    if (message.author.bot) return

    if (client.userId && mentionsBot(message.content, client.userId)) {
        const rest = stripMentions(message.content).toLowerCase()
        if (rest === '' || rest === 'help') {
            await client.rest.sendMessage(message.channel_id, buildHelpMessage())
            return
        }
    }

    if (!message.content.startsWith(PREFIX)) return

    const [name] = message.content.slice(PREFIX.length).trim().split(/\s+/)
    if (!name) return

    logger.debug(`Command "${name}" received from ${message.author.id}, not yet implemented`)
    // TODO: route to a command table once the prefix-command surface is designed.
}
