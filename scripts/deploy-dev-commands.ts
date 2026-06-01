/**
 * Registers /dev guild commands into DEV_GUILD_ID.
 * Guild-scoped commands are instant and never visible outside that server.
 * Usage: tsx scripts/deploy-dev-commands.ts
 */
import { REST, Routes, SlashCommandBuilder } from 'discord.js'
import { config } from '../src/config'

if (!config.DEV_GUILD_ID) {
    console.error('DEV_GUILD_ID is not set in .env')
    process.exit(1)
}

const devCommands = [
    new SlashCommandBuilder()
        .setName('dev')
        .setDescription('Dev/admin utilities (Administrator only)')
        .addSubcommand((sub) =>
            sub
                .setName('observers-refresh')
                .setDescription('Reload the observer cache from the tester role'),
        )
        .addSubcommand((sub) =>
            sub.setName('queue-status').setDescription('Show pending kicks in the queue'),
        )
        .addSubcommand((sub) =>
            sub.setName('queue-drain').setDescription('Retry all pending kicks in the queue'),
        )
        .toJSON(),
]

const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN)

;(async () => {
    console.log(`Registering /dev commands in guild ${config.DEV_GUILD_ID}...`)
    await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.DEV_GUILD_ID), {
        body: devCommands,
    })
    console.log('Done.')
})()
