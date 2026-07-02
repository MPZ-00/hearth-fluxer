// TODO(fluxer-commands): parked discord.js-shaped logic, not wired into package.json scripts.
// Fluxer has no slash-command/interaction system yet (see PORTING.md). Rewrite against
// Fluxer's own command-registration endpoint once one exists.
import { REST, Routes, SlashCommandBuilder } from 'discord.js'
import { config } from '../src/config'

const commands = [
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Go visible to your circle, or disappear')
        .addStringOption((opt) =>
            opt
                .setName('mode')
                .setDescription('on = your circle can see you, off = offline to everyone')
                .setRequired(true)
                .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' }),
        )
        .setDMPermission(true)
        .toJSON(),

    new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add someone to your circle')
        .addUserOption((opt) => opt.setName('user').setDescription('Who to add').setRequired(true))
        .setDMPermission(true)
        .toJSON(),

    new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove someone from your circle')
        .addUserOption((opt) =>
            opt.setName('user').setDescription('Who to remove').setRequired(true),
        )
        .setDMPermission(true)
        .toJSON(),

    new SlashCommandBuilder()
        .setName('list')
        .setDescription("Show who's in your circle")
        .setDMPermission(true)
        .toJSON(),

    new SlashCommandBuilder()
        .setName('notify')
        .setDescription('Get a DM when a circle member activates hearth')
        .addStringOption((opt) =>
            opt
                .setName('mode')
                .setDescription('on = notify me, off = no notifications')
                .setRequired(true)
                .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' }),
        )
        .setDMPermission(true)
        .toJSON(),

    new SlashCommandBuilder()
        .setName('host')
        .setDescription('Use a server you control as your own hearth circle gate')
        .addSubcommand((sub) =>
            sub.setName('invite').setDescription('Get a link to add hearth to your own server'),
        )
        .addSubcommand((sub) =>
            sub.setName('claim').setDescription('Register this server as a hearth circle gate'),
        )
        .addSubcommand((sub) =>
            sub.setName('unclaim').setDescription('Stop using this server as a hearth circle gate'),
        )
        .setDMPermission(true)
        .toJSON(),

    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show available commands')
        .setDMPermission(true)
        .toJSON(),
]

const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN)

;(async () => {
    console.log('Registering slash commands...')
    await rest.put(Routes.applicationCommands(config.CLIENT_ID), {
        body: commands,
    })
    console.log('Done.')
})()
