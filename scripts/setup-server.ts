/**
 * Server setup script. Safe to re-run: existing channels are skipped and pinned messages are
 * edited in place rather than creating duplicates.
 * Usage:
 *   tsx scripts/setup-server.ts official <GUILD_ID>
 *   tsx scripts/setup-server.ts dev <GUILD_ID>
 */

import {
    Client,
    GatewayIntentBits,
    ChannelType,
    PermissionFlagsBits,
    REST,
    Routes,
    type Guild,
    type CategoryChannel,
    type TextChannel,
    type Role,
} from 'discord.js'
import { config } from '../src/config'

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const [, , serverType, guildId] = process.argv

if ((serverType !== 'official' && serverType !== 'dev') || !guildId) {
    console.error('Usage: tsx scripts/setup-server.ts <official|dev> <GUILD_ID>')
    process.exit(1)
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const C = {
    ember: '#e8735a',
    deepEmber: '#c45c3a',
    warmOrange: '#f5a27a',
    ash: '#8c7b75',
    charcoal: '#1a1a1a',
    coolGrey: '#6b8c8a',
    ashGrey: '#3d3535',
} as const

// ---------------------------------------------------------------------------
// Command mentions
// ---------------------------------------------------------------------------

type CmdMap = Record<string, string>

/** Fetches registered global slash command IDs. Returns empty map on failure. */
async function fetchCommandMap(): Promise<CmdMap> {
    const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN)
    try {
        const cmds = (await rest.get(Routes.applicationCommands(config.CLIENT_ID))) as {
            id: string
            name: string
        }[]
        return Object.fromEntries(cmds.map((c) => [c.name, c.id]))
    } catch {
        console.warn('Could not fetch command IDs — messages will use plain text fallback.')
        return {}
    }
}

/** Returns an interactive slash command mention, or backtick fallback if ID is unknown. */
function s(cmd: CmdMap, name: string): string {
    const id = cmd[name]
    return id ? `</${name}:${id}>` : `\`/${name}\``
}

// ---------------------------------------------------------------------------
// Initial messages
// ---------------------------------------------------------------------------

function buildMessages(cmd: CmdMap, clientId: string) {
    const installUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&integration_type=1&scope=applications.commands`

    return {
        official: {
            welcome: `Welcome to the hearth server.

hearth lets you appear online only to the people you choose. Everyone else sees you offline.

**To get started:** add the bot to your apps, then run ${s(cmd, 'status')} \`on\`.
**[Install App](${installUrl})**

Once you have joined this server, your circle can see your real status.

Use ${s(cmd, 'add')} to add people to your circle. They need to add the bot and run ${s(cmd, 'status')} \`on\` themselves before you can see their status in return.

${s(cmd, 'status')} \`off\` removes you immediately. You go dark to everyone.

Source and self-hosting: https://github.com/MPZ-00/hearth`,

            rules: `1. Be decent to each other.
2. Keep #help on topic: setup questions, bugs, and usage only.
3. #showcase is for sharing how you're using hearth, not general chat.
4. No spam, no unsolicited DMs to other members.`,

            bugReportTemplate: `To report a bug, post a message here with:

- hearth version (check \`package.json\`)
- Self-hosted or public instance
- What you did
- What happened
- What you expected

The more specific, the faster it gets fixed.`,

            showcase: `This channel is for sharing how you're using hearth: friend groups, setups, anything worth showing. No support questions here; use #help for those.`,
        },

        dev: {
            devNotes: `This is where architecture decisions, open questions, and implementation notes live.

If you're making a non-obvious call in a PR, drop a note here first. Keeps the PR comments clean and gives context to anyone who comes back to it later.`,

            roadmap: `Current focus: v0.1.0, core functionality stable and self-hostable.

v0.2.0 will add multi-tenant support (one hosted instance, many hearth guilds).

Priorities are tracked in GitHub issues. This channel is for broader direction discussion.`,

            botTesting: `Test the dev bot instance here. The dev bot runs against a separate database so nothing here affects production.

Useful commands to test:
${s(cmd, 'status')} \`on\`: generates a one-time invite
${s(cmd, 'status')} \`off\`: kicks you from the hearth guild
${s(cmd, 'add')}: adds to whitelist
${s(cmd, 'list')}: shows your circle
${s(cmd, 'notify')} \`on\`, then go offline and come back online`,

            presenceLab: `Dedicated channel for testing presence events. Keep a few test accounts sitting here so \`presenceUpdate\` fires reliably.

To test notifications: enable ${s(cmd, 'notify')} \`on\`, have a second account go offline, then come back online. Check that the DM arrives and that flapping (going offline and online quickly) only sends one notification.`,
        },
    }
}

// ---------------------------------------------------------------------------
// Idempotent helpers
// ---------------------------------------------------------------------------

type RoleOptions = Parameters<Guild['roles']['create']>[0]

async function getOrCreateRole(guild: Guild, options: RoleOptions): Promise<Role> {
    const existing = guild.roles.cache.find((r) => r.name === options.name)
    if (existing) return existing
    return guild.roles.create(options)
}

async function getOrCreateCategory(guild: Guild, name: string): Promise<CategoryChannel> {
    const existing = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name === name,
    )
    if (existing) return existing as CategoryChannel
    return guild.channels.create({
        name,
        type: ChannelType.GuildCategory,
    }) as Promise<CategoryChannel>
}

async function getOrCreateChannel(
    guild: Guild,
    name: string,
    parent: CategoryChannel,
    overwrites: { id: string; allow?: bigint[]; deny?: bigint[] }[] = [],
): Promise<TextChannel> {
    const existing = guild.channels.cache.find(
        (c) => c.name === name && 'parentId' in c && c.parentId === parent.id,
    )
    if (existing) return existing as TextChannel
    return guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: parent.id,
        permissionOverwrites: overwrites,
    }) as Promise<TextChannel>
}

/** Edits the bot's existing pinned message, or sends a new one and pins it. */
async function pinOrUpdate(channel: TextChannel, botId: string, content: string): Promise<void> {
    const pins = await channel.messages.fetchPinned()
    const mine = pins.find((m) => m.author.id === botId)
    if (mine) {
        await mine.edit(content)
    } else {
        const msg = await channel.send(content)
        await msg.pin()
    }
}

function readonlyOverwrites(everyoneId: string, writerRoleId: string) {
    return [
        { id: everyoneId, deny: [PermissionFlagsBits.SendMessages] },
        { id: writerRoleId, allow: [PermissionFlagsBits.SendMessages] },
    ]
}

// ---------------------------------------------------------------------------
// Official server setup
// ---------------------------------------------------------------------------

async function setupOfficial(guild: Guild, cmd: CmdMap, botId: string) {
    const M = buildMessages(cmd, botId).official

    await guild.roles.fetch()
    await guild.channels.fetch()

    console.log('Creating roles...')
    const everyone = guild.roles.everyone

    const keeper = await getOrCreateRole(guild, {
        name: 'keeper',
        colors: { primaryColor: C.ember },
        hoist: true,
        permissions: [PermissionFlagsBits.Administrator],
    })
    const tender = await getOrCreateRole(guild, {
        name: 'tender',
        colors: { primaryColor: C.deepEmber },
        hoist: true,
        permissions: [
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.KickMembers,
            PermissionFlagsBits.ModerateMembers,
        ],
    })
    await getOrCreateRole(guild, {
        name: 'ember',
        colors: { primaryColor: C.warmOrange },
        hoist: false,
        permissions: [],
    })
    await getOrCreateRole(guild, {
        name: 'guest',
        colors: { primaryColor: C.ash },
        hoist: false,
        permissions: [],
    })
    await getOrCreateRole(guild, {
        name: 'hearth',
        colors: { primaryColor: C.charcoal },
        hoist: false,
        permissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
    })

    void tender

    await guild.roles.everyone.setPermissions([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
    ])

    console.log('Creating channels...')

    const catStart = await getOrCreateCategory(guild, '📌 start here')
    const catUpdates = await getOrCreateCategory(guild, '🔔 updates')
    const catCommunity = await getOrCreateCategory(guild, '🔥 community')
    const catSupport = await getOrCreateCategory(guild, '🛠 support')

    const welcome = await getOrCreateChannel(
        guild,
        'welcome',
        catStart,
        readonlyOverwrites(everyone.id, keeper.id),
    )
    const rules = await getOrCreateChannel(
        guild,
        'rules',
        catStart,
        readonlyOverwrites(everyone.id, keeper.id),
    )
    const announcements = await getOrCreateChannel(
        guild,
        'announcements',
        catUpdates,
        readonlyOverwrites(everyone.id, keeper.id),
    )
    await getOrCreateChannel(
        guild,
        'changelog',
        catUpdates,
        readonlyOverwrites(everyone.id, keeper.id),
    )
    await getOrCreateChannel(guild, 'general', catCommunity)
    const showcase = await getOrCreateChannel(guild, 'showcase', catCommunity)
    await getOrCreateChannel(guild, 'help', catSupport)
    const bugReports = await getOrCreateChannel(guild, 'bug-reports', catSupport)

    console.log('Posting messages...')

    await pinOrUpdate(welcome, botId, M.welcome)
    await pinOrUpdate(rules, botId, M.rules)
    await pinOrUpdate(bugReports, botId, M.bugReportTemplate)

    const annPins = await announcements.messages.fetchPinned()
    if (annPins.size === 0) await announcements.send('Announcements will appear here.')

    const showcasePins = await showcase.messages.fetchPinned()
    if (showcasePins.size === 0) await showcase.send(M.showcase)

    const owner = await guild.fetchOwner()
    if (!owner.roles.cache.has(keeper.id)) {
        await owner.roles.add(keeper)
        console.log(`Assigned keeper to ${owner.user.tag}`)
    }
    console.log(
        'Move the bot\'s role above "keeper" in Server Settings > Roles before users can be assigned it.',
    )
}

// ---------------------------------------------------------------------------
// Dev server setup
// ---------------------------------------------------------------------------

async function setupDev(guild: Guild, cmd: CmdMap, botId: string) {
    const M = buildMessages(cmd, botId).dev

    await guild.roles.fetch()
    await guild.channels.fetch()

    console.log('Creating roles...')
    const everyone = guild.roles.everyone

    const architect = await getOrCreateRole(guild, {
        name: 'architect',
        colors: { primaryColor: C.ember },
        hoist: true,
        permissions: [PermissionFlagsBits.Administrator],
    })
    const maintainer = await getOrCreateRole(guild, {
        name: 'maintainer',
        colors: { primaryColor: C.deepEmber },
        hoist: true,
        permissions: [PermissionFlagsBits.ManageMessages],
    })
    await getOrCreateRole(guild, {
        name: 'spark',
        colors: { primaryColor: C.warmOrange },
        hoist: false,
        permissions: [],
    })
    await getOrCreateRole(guild, {
        name: 'tester',
        colors: { primaryColor: C.coolGrey },
        hoist: false,
        permissions: [],
    })
    await getOrCreateRole(guild, {
        name: 'hearth [dev]',
        colors: { primaryColor: C.ashGrey },
        hoist: false,
        permissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
    })

    await guild.roles.everyone.setPermissions([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
    ])

    console.log('Creating channels...')

    const catMeta = await getOrCreateCategory(guild, '📌 meta')
    const catDev = await getOrCreateCategory(guild, '🔨 development')
    const catTesting = await getOrCreateCategory(guild, '🧪 testing')
    const catBots = await getOrCreateCategory(guild, '🤖 bots')

    const devNotes = await getOrCreateChannel(guild, 'dev-notes', catMeta)
    const roadmap = await getOrCreateChannel(
        guild,
        'roadmap',
        catMeta,
        readonlyOverwrites(everyone.id, architect.id),
    )
    await getOrCreateChannel(
        guild,
        'commits',
        catDev,
        readonlyOverwrites(everyone.id, maintainer.id),
    )
    await getOrCreateChannel(
        guild,
        'pull-requests',
        catDev,
        readonlyOverwrites(everyone.id, maintainer.id),
    )
    await getOrCreateChannel(
        guild,
        'issues',
        catDev,
        readonlyOverwrites(everyone.id, maintainer.id),
    )
    const botTesting = await getOrCreateChannel(guild, 'bot-testing', catTesting)
    const presenceLab = await getOrCreateChannel(guild, 'presence-lab', catTesting)
    await getOrCreateChannel(
        guild,
        'logs',
        catTesting,
        readonlyOverwrites(everyone.id, maintainer.id),
    )
    await getOrCreateChannel(guild, 'hearth-dev', catBots)

    console.log('Posting messages...')

    await pinOrUpdate(devNotes, botId, M.devNotes)
    await pinOrUpdate(roadmap, botId, M.roadmap)
    await pinOrUpdate(botTesting, botId, M.botTesting)
    await pinOrUpdate(presenceLab, botId, M.presenceLab)

    const owner = await guild.fetchOwner()
    if (!owner.roles.cache.has(architect.id)) {
        await owner.roles.add(architect)
        console.log(`Assigned architect to ${owner.user.tag}`)
    }
    console.log(
        'Move the bot\'s role above "architect" in Server Settings > Roles before users can be assigned it.',
    )
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

client.once('clientReady', async (c) => {
    console.log(`Logged in as ${c.user.tag}`)

    const guild = await client.guilds.fetch(guildId).catch(() => null)
    if (!guild) {
        console.error(`Guild ${guildId} not found. Is the bot in that server?`)
        process.exit(1)
    }

    const fullGuild = (await client.guilds.fetch(guildId)) as Guild
    console.log(`Setting up ${serverType} server: ${fullGuild.name}`)

    const cmd = await fetchCommandMap()
    if (Object.keys(cmd).length === 0) {
        console.warn(
            'No command IDs found. Run `npm run deploy` first for interactive command mentions.',
        )
    }

    try {
        if (serverType === 'official') {
            await setupOfficial(fullGuild, cmd, c.user.id)
        } else {
            await setupDev(fullGuild, cmd, c.user.id)
        }
        console.log('Done.')
    } catch (err) {
        console.error('Setup failed:', err)
    }

    client.destroy()
    process.exit(0)
})

client.login(config.DISCORD_TOKEN)
