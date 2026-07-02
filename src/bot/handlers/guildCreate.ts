import type { GuildDispatch } from '../../fluxer/types'
import { claimGuild } from '../../services/host'
import { config } from '../../config'
import { logger } from '../../logger'

export function handleGuildCreate(guild: GuildDispatch) {
    if (guild.id === config.HEARTH_GUILD_ID) return

    if (claimGuild(guild.id)) {
        logger.info(`Auto-claimed guild ${guild.id}`)
    }
}
