/**
 * One-shot server setup. Run once on a fresh guild.
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
    ember: 0xe8735a,
    deepEmber: 0xc45c3a,
    warmOrange: 0xf5a27a,
    ash: 0x8c7b75,
    charcoal: 0x1a1a1a,
    coolGrey: 0x6b8c8a,
    ashGrey: 0x3d3535,
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
function s(cmd: CmdMap, name: string, sub?: string): string {
    const fullName = sub ? `${name} ${sub}` : name
    const id = cmd[name]
    return id ? `</${fullName}:${id}>` : `\`/${fullName}\``
}

// ---------------------------------------------------------------------------
// Initial messages
// ---------------------------------------------------------------------------

function buildMessages(cmd: CmdMap) {
    return {
        official: {
            welcome: `Welcome to the hearth server.

hearth lets you appear online only to the people you choose. Everyone else sees you offline.

To get started, add the hearth bot to your apps, then run ${s(cmd, 'status', 'on')}. You'll get a one-time invite to join this server. Once you're in, your circle can see your real status.

Use ${s(cmd, 'add')} to add people to your circle. They'll need to run ${s(cmd, 'status', 'on')} themselves before you can see their status in return.

${s(cmd, 'status', 'off')} removes you immediately. You go dark to everyone.

Source and self-hosting: https://github.com/MPZ-00/hearth`,

            rules: `1. Be decent to each other.
2. Keep #help on topic — setup questions, bugs, and usage only.
3. #showcase is for sharing how you're using hearth, not general chat.
4. No spam, no unsolicited DMs to other members.`,

            bugReportTemplate: `To report a bug, post a message here with:

- hearth version (check \`package.json\`)
- Self-hosted or public instance
- What you did
- What happened
- What you expected

The more specific, the faster it gets fixed.`,

            showcase: `This channel is for sharing how you're using hearth — friend groups, setups, anything worth showing. No support questions here; use #help for those.`,
        },

        dev: {
            devNotes: `This is where architecture decisions, open questions, and implementation notes live.

If you're making a non-obvious call in a PR, drop a note here first. Keeps the PR comments clean and gives context to anyone who comes back to it later.`,

            roadmap: `Current focus: v0.1.0 — core functionality stable and self-hostable.

v0.2.0 will add multi-tenant support (one hosted instance, many hearth guilds).

Priorities are tracked in GitHub issues. This channel is for broader direction discussion.`,

            botTesting: `Test the dev bot instance here. The dev bot runs against a separate database so nothing here affects production.

Useful commands to test:
${s(cmd, 'status', 'on')} — should generate a one-time invite
${s(cmd, 'status', 'off')} — should kick you from the hearth guild
${s(cmd, 'add')} — adds to whitelist
${s(cmd, 'list')} — shows your circle
${s(cmd, 'notify', 'on')} then go offline and come back online`,

            presenceLab: `Dedicated channel for testing presence events. Keep a few test accounts sitting here so \`presenceUpdate\` fires reliably.

To test notifications: enable ${s(cmd, 'notify', 'on')}, have a second account go offline, then come back online. Check that the DM arrives and that flapping (offline→online→offline→online quickly) only sends one notification.`,
        },
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeCategory(guild: Guild, name: string): Promise<CategoryChannel> {
    return guild.channels.create({
        name,
        type: ChannelType.GuildCategory,
    }) as Promise<CategoryChannel>
}

async function makeChannel(
    guild: Guild,
    name: string,
    parent: CategoryChannel,
    overwrites: { id: string; allow?: bigint[]; deny?: bigint[] }[] = [],
): Promise<TextChannel> {
    return guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: parent.id,
        permissionOverwrites: overwrites,
    }) as Promise<TextChannel>
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

async function setupOfficial(guild: Guild, cmd: CmdMap) {
    const M = buildMessages(cmd).official
    console.log('Creating roles...')

    const everyone = guild.roles.everyone

    const keeper = await guild.roles.create({
        name: 'keeper',
        color: C.ember,
        hoist: true,
        permissions: [PermissionFlagsBits.Administrator],
    })
    const tender = await guild.roles.create({
        name: 'tender',
        color: C.deepEmber,
        hoist: true,
        permissions: [
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.KickMembers,
            PermissionFlagsBits.ModerateMembers,
        ],
    })
    await guild.roles.create({ name: 'ember', color: C.warmOrange, hoist: false, permissions: [] })
    await guild.roles.create({ name: 'guest', color: C.ash, hoist: false, permissions: [] })
    await guild.roles.create({
        name: 'hearth',
        color: C.charcoal,
        hoist: false,
        permissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
    })

    await guild.roles.everyone.setPermissions([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
    ])

    console.log('Creating channels...')

    const catStart = await makeCategory(guild, '📌 start here')
    const welcome = await makeChannel(
        guild,
        'welcome',
        catStart,
        readonlyOverwrites(everyone.id, keeper.id),
    )
    const rules = await makeChannel(
        guild,
        'rules',
        catStart,
        readonlyOverwrites(everyone.id, keeper.id),
    )

    const catUpdates = await makeCategory(guild, '🔔 updates')
    const announcements = await makeChannel(
        guild,
        'announcements',
        catUpdates,
        readonlyOverwrites(everyone.id, keeper.id),
    )
    await makeChannel(guild, 'changelog', catUpdates, readonlyOverwrites(everyone.id, keeper.id))

    const catCommunity = await makeCategory(guild, '🔥 community')
    await makeChannel(guild, 'general', catCommunity)
    const showcase = await makeChannel(guild, 'showcase', catCommunity)

    const catSupport = await makeCategory(guild, '🛠 support')
    await makeChannel(guild, 'help', catSupport)
    const bugReports = await makeChannel(guild, 'bug-reports', catSupport)

    console.log('Posting initial messages...')

    const welcomeMsg = await welcome.send(M.welcome)
    await welcomeMsg.pin()

    const rulesMsg = await rules.send(M.rules)
    await rulesMsg.pin()

    await announcements.send('Announcements will appear here.')
    await showcase.send(M.showcase)

    const bugMsg = await bugReports.send(M.bugReportTemplate)
    await bugMsg.pin()

    const owner = await guild.fetchOwner()
    await owner.roles.add(keeper)
    console.log(`Assigned keeper to ${owner.user.tag}`)
    console.log(
        '⚠️  Move the bot\'s role ABOVE "keeper" in Server Settings → Roles before users can be assigned it.',
    )
}

// ---------------------------------------------------------------------------
// Dev server setup
// ---------------------------------------------------------------------------

async function setupDev(guild: Guild, cmd: CmdMap) {
    const M = buildMessages(cmd).dev
    console.log('Creating roles...')

    const everyone = guild.roles.everyone

    const architect = await guild.roles.create({
        name: 'architect',
        color: C.ember,
        hoist: true,
        permissions: [PermissionFlagsBits.Administrator],
    })
    const maintainer = await guild.roles.create({
        name: 'maintainer',
        color: C.deepEmber,
        hoist: true,
        permissions: [PermissionFlagsBits.ManageMessages],
    })
    await guild.roles.create({ name: 'spark', color: C.warmOrange, hoist: false, permissions: [] })
    await guild.roles.create({ name: 'tester', color: C.coolGrey, hoist: false, permissions: [] })
    await guild.roles.create({
        name: 'hearth [dev]',
        color: C.ashGrey,
        hoist: false,
        permissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
    })

    await guild.roles.everyone.setPermissions([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
    ])

    console.log('Creating channels...')

    const catMeta = await makeCategory(guild, '📌 meta')
    const devNotes = await makeChannel(guild, 'dev-notes', catMeta)
    const roadmap = await makeChannel(
        guild,
        'roadmap',
        catMeta,
        readonlyOverwrites(everyone.id, architect.id),
    )

    const catDev = await makeCategory(guild, '🔨 development')
    await makeChannel(guild, 'commits', catDev, readonlyOverwrites(everyone.id, maintainer.id))
    await makeChannel(
        guild,
        'pull-requests',
        catDev,
        readonlyOverwrites(everyone.id, maintainer.id),
    )
    await makeChannel(guild, 'issues', catDev, readonlyOverwrites(everyone.id, maintainer.id))

    const catTesting = await makeCategory(guild, '🧪 testing')
    const botTesting = await makeChannel(guild, 'bot-testing', catTesting)
    const presenceLab = await makeChannel(guild, 'presence-lab', catTesting)
    await makeChannel(guild, 'logs', catTesting, readonlyOverwrites(everyone.id, maintainer.id))

    const catBots = await makeCategory(guild, '🤖 bots')
    await makeChannel(guild, 'hearth-dev', catBots)

    console.log('Posting initial messages...')

    const notesMsg = await devNotes.send(M.devNotes)
    await notesMsg.pin()

    const roadmapMsg = await roadmap.send(M.roadmap)
    await roadmapMsg.pin()

    const testMsg = await botTesting.send(M.botTesting)
    await testMsg.pin()

    const labMsg = await presenceLab.send(M.presenceLab)
    await labMsg.pin()

    const owner = await guild.fetchOwner()
    await owner.roles.add(architect)
    console.log(`Assigned architect to ${owner.user.tag}`)
    console.log(
        '⚠️  Move the bot\'s role ABOVE "architect" in Server Settings → Roles before users can be assigned it.',
    )
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

client.once('ready', async () => {
    console.log(`Logged in as ${client.user!.tag}`)

    const guild = await client.guilds.fetch(guildId).catch(() => null)
    if (!guild) {
        console.error(`Guild ${guildId} not found — is the bot in that server?`)
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
            await setupOfficial(fullGuild, cmd)
        } else {
            await setupDev(fullGuild, cmd)
        }
        console.log('Done.')
    } catch (err) {
        console.error('Setup failed:', err)
    }

    client.destroy()
    process.exit(0)
})

client.login(config.DISCORD_TOKEN)
