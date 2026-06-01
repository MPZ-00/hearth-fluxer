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
    type Guild,
    type Role,
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
// Initial messages
// ---------------------------------------------------------------------------

const MESSAGES = {
    official: {
        welcome: `Welcome to the hearth server.

hearth lets you appear online only to the people you choose. Everyone else sees you offline.

To get started, run \`/status on\` anywhere the bot is installed, or DM it directly. You'll get a one-time invite to join this server. Once you're in, your circle can see your real status.

Use \`/add @someone\` to add people to your circle. They'll need to run \`/status on\` themselves before you can see their status in return.

\`/status off\` removes you immediately. You go dark to everyone.

Source and self-hosting: https://github.com/MPZ-00/hearth`,

        rules: `1. Be decent to each other.
2. Keep #help on topic ─ setup questions, bugs, and usage only.
3. #showcase is for sharing how you're using hearth, not general chat.
4. No spam, no unsolicited DMs to other members.`,

        bugReportTemplate: `To report a bug, post a message here with:

- hearth version (check \`package.json\`)
- Self-hosted or public instance
- What you did
- What happened
- What you expected

The more specific, the faster it gets fixed.`,

        showcase: `This channel is for sharing how you're using hearth ─ friend groups, setups, anything worth showing. No support questions here; use #help for those.`,
    },

    dev: {
        devNotes: `This is where architecture decisions, open questions, and implementation notes live.

If you're making a non-obvious call in a PR, drop a note here first. Keeps the PR comments clean and gives context to anyone who comes back to it later.`,

        roadmap: `Current focus: v0.1.0 ─ core functionality stable and self-hostable.

v0.2.0 will add multi-tenant support (one hosted instance, many hearth guilds).

Priorities are tracked in GitHub issues. This channel is for broader direction discussion.`,

        botTesting: `Test the dev bot instance here. The dev bot runs against a separate database so nothing here affects production.

Useful commands to test:
\`/status on\` ─ should generate a one-time invite
\`/status off\` ─ should kick you from the hearth guild
\`/add @someone\` ─ adds to whitelist
\`/list\` ─ shows your circle
\`/notify on\` then go offline and come back online`,

        presenceLab: `Dedicated channel for testing presence events. Keep a few test accounts sitting here so \`presenceUpdate\` fires reliably.

To test notifications: enable \`/notify on\`, have a second account go offline, then come back online. Check that the DM arrives and that flapping (offline→online→offline→online quickly) only sends one notification.`,
    },
} as const

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

async function setupOfficial(guild: Guild) {
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
    await guild.roles.create({
        name: 'ember',
        color: C.warmOrange,
        hoist: false,
        permissions: [],
    })
    await guild.roles.create({
        name: 'guest',
        color: C.ash,
        hoist: false,
        permissions: [],
    })
    await guild.roles.create({
        name: 'hearth',
        color: C.charcoal,
        hoist: false,
        permissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
    })

    // Restrict @everyone from sending in announcement-type channels by default
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

    await welcome.send(MESSAGES.official.welcome)
    await welcome.bulkDelete(0) // no-op; message is intentionally not pinned so it stays as first
    const welcomeMsg = (await welcome.messages.fetch({ limit: 1 })).first()
    if (welcomeMsg) await welcomeMsg.pin()

    await rules.send(MESSAGES.official.rules)
    const rulesMsg = (await rules.messages.fetch({ limit: 1 })).first()
    if (rulesMsg) await rulesMsg.pin()

    await announcements.send('Announcements will appear here.')
    await showcase.send(MESSAGES.official.showcase)
    await bugReports.send(MESSAGES.official.bugReportTemplate)
    const bugMsg = (await bugReports.messages.fetch({ limit: 1 })).first()
    if (bugMsg) await bugMsg.pin()

    // Assign keeper role to the bot owner (guild owner)
    const owner = await guild.fetchOwner()
    await owner.roles.add(keeper)
    console.log(`Assigned keeper to server owner ${owner.user.tag}`)
}

// ---------------------------------------------------------------------------
// Dev server setup
// ---------------------------------------------------------------------------

async function setupDev(guild: Guild) {
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
    await guild.roles.create({
        name: 'spark',
        color: C.warmOrange,
        hoist: false,
        permissions: [],
    })
    await guild.roles.create({
        name: 'tester',
        color: C.coolGrey,
        hoist: false,
        permissions: [],
    })
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

    await devNotes.send(MESSAGES.dev.devNotes)
    const notesMsg = (await devNotes.messages.fetch({ limit: 1 })).first()
    if (notesMsg) await notesMsg.pin()

    await roadmap.send(MESSAGES.dev.roadmap)
    const roadmapMsg = (await roadmap.messages.fetch({ limit: 1 })).first()
    if (roadmapMsg) await roadmapMsg.pin()

    await botTesting.send(MESSAGES.dev.botTesting)
    const testMsg = (await botTesting.messages.fetch({ limit: 1 })).first()
    if (testMsg) await testMsg.pin()

    await presenceLab.send(MESSAGES.dev.presenceLab)
    const labMsg = (await presenceLab.messages.fetch({ limit: 1 })).first()
    if (labMsg) await labMsg.pin()

    // Assign architect to guild owner
    const owner = await guild.fetchOwner()
    await owner.roles.add(architect)
    console.log(`Assigned architect to server owner ${owner.user.tag}`)
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

client.once('ready', async () => {
    console.log(`Logged in as ${client.user!.tag}`)

    const guild = await client.guilds.fetch(guildId).catch(() => null)
    if (!guild) {
        console.error(`Guild ${guildId} not found ─ is the bot in that server?`)
        process.exit(1)
    }

    // Fetch full guild object (guilds.fetch returns OAuth2Guild for large bot lists)
    const fullGuild = (await client.guilds.fetch(guildId)) as Guild

    console.log(`Setting up ${serverType} server: ${fullGuild.name}`)

    try {
        if (serverType === 'official') {
            await setupOfficial(fullGuild)
        } else {
            await setupDev(fullGuild)
        }
        console.log('Done.')
    } catch (err) {
        console.error('Setup failed:', err)
    }

    client.destroy()
    process.exit(0)
})

client.login(config.DISCORD_TOKEN)
