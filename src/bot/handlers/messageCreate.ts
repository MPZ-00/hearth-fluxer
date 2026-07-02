import type { FluxerClient } from '../client'
import { logger } from '../../logger'

// TODO: Fluxer has no slash-command/interaction system yet (confirmed: no ApplicationCommand
// or InteractionType anywhere in fluxerapp/fluxer, as of this port), though one is reportedly
// coming. The 7 hearth commands (status, add, remove, list, notify, host, help) are parked in
// src/commands/*.ts and need either a prefix-command rewrite here, or an in-place adaptation
// once Fluxer's own command API ships. See PORTING.md.

const PREFIX = '!'

interface MessageCreateDispatch {
    id: string
    channel_id: string
    guild_id?: string
    author: { id: string; bot?: boolean }
    content: string
}

export async function handleMessageCreate(client: FluxerClient, message: MessageCreateDispatch) {
    if (message.author.bot) return
    if (!message.content.startsWith(PREFIX)) return

    const [name] = message.content.slice(PREFIX.length).trim().split(/\s+/)
    if (!name) return

    logger.debug(`Command "${name}" received from ${message.author.id}, not yet implemented`)
    // TODO: route to a command table once the prefix-command surface is designed.
}
