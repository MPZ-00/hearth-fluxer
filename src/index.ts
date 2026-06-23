import { Events, ActivityType } from 'discord.js'
import { config } from './config'
import { db } from './db/client'
import { hearthGuilds } from './db/schema'
import { createClient } from './bot/client'
import { handleInteractionCreate } from './bot/handlers/interactionCreate'
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

const client = createClient()

client.once(Events.ClientReady, async (c) => {
    logger.info(`Logged in as ${c.user.tag} — ${BOT_VERSION}`)
    c.user.setActivity(BOT_VERSION, { type: ActivityType.Playing })

    if (config.HEARTH_GUILD_ID) {
        db.insert(hearthGuilds)
            .values({ guildId: config.HEARTH_GUILD_ID })
            .onConflictDoNothing()
            .run()
        logger.info(`Hearth guild: ${config.HEARTH_GUILD_ID}`)
        await initInviteCache(c, config.HEARTH_GUILD_ID)
        logger.debug('Invite cache initialised')
    }

    if (config.OBSERVER_GUILD_ID) {
        await initObserverCache(c, config.OBSERVER_GUILD_ID, config.OBSERVER_ROLE)
    }

    const drained = await drainKickQueue(c)
    if (drained.success > 0 || drained.failed > 0) {
        logger.info(
            `Startup kick queue drain: ${drained.success} succeeded, ${drained.failed} still pending`,
        )
    }
})

client.on(Events.InteractionCreate, handleInteractionCreate)
client.on(Events.GuildMemberAdd, handleGuildMemberAdd)
client.on(Events.GuildMemberRemove, handleGuildMemberRemove)
client.on(Events.GuildCreate, handleGuildCreate)
client.on(Events.GuildDelete, handleGuildDelete)
client.on(Events.PresenceUpdate, handlePresenceUpdate)
client.on(Events.InviteCreate, (invite) => {
    if (invite.guild) trackInviteCreate(invite.guild.id, invite.code)
})
client.on(Events.InviteDelete, (invite) => {
    if (invite.guild) removeFromCache(invite.guild.id, invite.code)
})

client.login(config.DISCORD_TOKEN)
