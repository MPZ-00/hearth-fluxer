import { config } from './config'
import { db } from './db/client'
import { hearthGuilds } from './db/schema'
import { createClient } from './bot/client'
import { startActivityRotation } from './bot/activity'
import { handleMessageCreate } from './bot/handlers/messageCreate'
import { handleGuildMemberAdd } from './bot/handlers/guildMemberAdd'
import { handleGuildMemberRemove } from './bot/handlers/guildMemberRemove'
import { handleGuildCreate } from './bot/handlers/guildCreate'
import { handleGuildDelete } from './bot/handlers/guildDelete'
import { handlePresenceUpdate } from './bot/handlers/presenceUpdate'
import { initInviteCache, trackInviteCreate, removeFromCache } from './bot/inviteCache'
import { initObserverCache } from './bot/observerCache'
import { drainKickQueue } from './services/kickQueue'
import { logger } from './logger'
import { BOT_VERSION } from './version'
import type {
    GuildDispatch,
    GuildMemberAddDispatch,
    GuildMemberRemoveDispatch,
    InviteCreateDispatch,
    InviteDeleteDispatch,
    PresenceUpdateDispatch,
    ReadyDispatch,
} from './fluxer/types'

async function main() {
    const client = await createClient()
    startActivityRotation(client)
    client.gateway.connect()

    client.gateway.onDispatch<ReadyDispatch>('READY', async (d) => {
        logger.info(`Logged in as ${d.user.username}, ${BOT_VERSION}`)

        if (config.HEARTH_GUILD_ID) {
            db.insert(hearthGuilds)
                .values({ guildId: config.HEARTH_GUILD_ID })
                .onConflictDoNothing()
                .run()
            logger.info(`Hearth guild: ${config.HEARTH_GUILD_ID}`)
            await initInviteCache(client, config.HEARTH_GUILD_ID)
            logger.debug('Invite cache initialised')
        }

        if (config.OBSERVER_GUILD_ID) {
            await initObserverCache(client, config.OBSERVER_GUILD_ID, config.OBSERVER_ROLE)
        }

        const drained = await drainKickQueue(client)
        if (drained.success > 0 || drained.failed > 0) {
            logger.info(
                `Startup kick queue drain: ${drained.success} succeeded, ${drained.failed} still pending`,
            )
        }
    })

    client.gateway.onDispatch('MESSAGE_CREATE', (d) => handleMessageCreate(client, d as never))
    client.gateway.onDispatch<GuildMemberAddDispatch>('GUILD_MEMBER_ADD', (d) =>
        handleGuildMemberAdd(client, d),
    )
    client.gateway.onDispatch<GuildMemberRemoveDispatch>('GUILD_MEMBER_REMOVE', (d) =>
        handleGuildMemberRemove(client, d),
    )
    client.gateway.onDispatch<GuildDispatch>('GUILD_CREATE', handleGuildCreate)
    client.gateway.onDispatch<GuildDispatch>('GUILD_DELETE', (d) => handleGuildDelete(client, d))
    client.gateway.onDispatch<PresenceUpdateDispatch>('PRESENCE_UPDATE', (d) =>
        handlePresenceUpdate(client, d),
    )
    client.gateway.onDispatch<InviteCreateDispatch>('INVITE_CREATE', (d) => {
        if (d.guild_id) trackInviteCreate(d.guild_id, d.code)
    })
    client.gateway.onDispatch<InviteDeleteDispatch>('INVITE_DELETE', (d) => {
        if (d.guild_id) removeFromCache(d.guild_id, d.code)
    })
}

main().catch((err) => {
    logger.error('Fatal startup error:', err)
    process.exit(1)
})
