/**
 * Server setup script. Safe to re-run: existing channels are skipped and pinned messages are
 * edited in place rather than creating duplicates.
 * Usage:
 *   tsx scripts/setup-server.ts official <GUILD_ID>
 *   tsx scripts/setup-server.ts dev <GUILD_ID>
 */

// TODO(fluxer-commands): command-mention formatting (fetchCommandMap/s()) is parked pending
// Fluxer's own command API, same as src/commands/*.ts. Falls back to plain `/name` text.
// AutoMod setup was dropped entirely, not parked: Fluxer has no auto-moderation system
// (confirmed, no AutoMod-related code anywhere in fluxerapp/fluxer). See PORTING.md.
import { FluxerRest } from '../src/fluxer/rest'
import {
    FluxerChannelTypes,
    FluxerPermissions,
    type FluxerChannel,
    type FluxerChannelOverwrite,
    type FluxerRole,
} from '../src/fluxer/types'
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

/** Returns the plain-text command form. Interactive mentions need Fluxer's own command API. */
function s(name: string): string {
    return `\`/${name}\``
}

// ---------------------------------------------------------------------------
// Initial messages
// ---------------------------------------------------------------------------

function buildMessages() {
    return {
        official: {
            welcome: `Welcome to the hearth server.

hearth lets you appear online only to the people you choose. Everyone else sees you offline.

**To get started:** add the bot to your apps, then run ${s('status')} \`on\`.

Once you have joined this server, your circle can see your real status.

Use ${s('add')} to add people to your circle. They need to add the bot and run ${s('status')} \`on\` themselves before you can see their status in return.
${s('status')} \`off\` removes you immediately. You go dark to everyone.

Source and self-hosting: https://github.com/MPZ-00/hearth-fluxer`,

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

            roadmap: `Current focus: getting the Fluxer port to a working state, starting with a real command surface once Fluxer ships one.

Priorities are tracked in GitHub issues and PORTING.md. This channel is for broader direction discussion.`,

            botTesting: `Test the dev bot instance here. The dev bot runs against a separate database so nothing here affects production.

Useful commands to test (once the command layer works again):
${s('status')} \`on\`: generates a one-time invite
${s('status')} \`off\`: kicks you from the hearth guild
${s('add')}: adds to whitelist
${s('list')}: shows your circle
${s('notify')} \`on\`, then go offline and come back online`,

            presenceLab: `Dedicated channel for testing presence events. Keep a few test accounts sitting here so \`presenceUpdate\` fires reliably.

To test notifications: enable ${s('notify')} \`on\`, have a second account go offline, then come back online. Check that the DM arrives and that flapping (going offline and online quickly) only sends one notification.`,
        },
    }
}

// ---------------------------------------------------------------------------
// Idempotent helpers
// ---------------------------------------------------------------------------

async function getOrCreateRole(
    rest: FluxerRest,
    guildId: string,
    existingRoles: FluxerRole[],
    options: { name: string; color: number; hoist?: boolean; permissions?: bigint },
): Promise<FluxerRole> {
    const existing = existingRoles.find((r) => r.name === options.name)
    if (existing) return existing
    const role = await rest.createGuildRole(guildId, {
        name: options.name,
        color: options.color,
        permissions: options.permissions?.toString(),
    })
    if (options.hoist) await rest.updateGuildRole(guildId, role.id, { hoist: true })
    existingRoles.push(role)
    return role
}

async function getOrCreateCategory(
    rest: FluxerRest,
    guildId: string,
    existingChannels: FluxerChannel[],
    name: string,
): Promise<FluxerChannel> {
    const existing = existingChannels.find(
        (c) => c.type === FluxerChannelTypes.GUILD_CATEGORY && c.name === name,
    )
    if (existing) return existing
    const category = await rest.createGuildChannel(guildId, {
        type: FluxerChannelTypes.GUILD_CATEGORY,
        name,
    })
    existingChannels.push(category)
    return category
}

async function getOrCreateChannel(
    rest: FluxerRest,
    guildId: string,
    existingChannels: FluxerChannel[],
    name: string,
    parent: FluxerChannel,
    overwrites: FluxerChannelOverwrite[] = [],
): Promise<FluxerChannel> {
    const existing = existingChannels.find((c) => c.name === name && c.parent_id === parent.id)
    if (existing) return existing
    const channel = await rest.createGuildChannel(guildId, {
        type: FluxerChannelTypes.GUILD_TEXT,
        name,
        parent_id: parent.id,
        permission_overwrites: overwrites,
    })
    existingChannels.push(channel)
    return channel
}

/** Edits the bot's existing pinned message, or sends a new one and pins it. */
async function pinOrUpdate(
    rest: FluxerRest,
    channel: FluxerChannel,
    botId: string,
    content: string,
): Promise<void> {
    const pins = await rest.listPinnedMessages(channel.id)
    const mine = pins.find((m) => m.author.id === botId)
    if (mine) {
        await rest.editMessage(channel.id, mine.id, content)
    } else {
        const msg = await rest.sendMessage(channel.id, content)
        await rest.pinMessage(channel.id, msg.id)
    }
}

function readonlyOverwrites(everyoneId: string, writerRoleId: string): FluxerChannelOverwrite[] {
    return [
        { id: everyoneId, type: 0, deny: FluxerPermissions.SEND_MESSAGES.toString() },
        { id: writerRoleId, type: 0, allow: FluxerPermissions.SEND_MESSAGES.toString() },
    ]
}

function staffOnlyOverwrites(everyoneId: string, staffRoleId: string): FluxerChannelOverwrite[] {
    return [
        { id: everyoneId, type: 0, deny: FluxerPermissions.VIEW_CHANNEL.toString() },
        {
            id: staffRoleId,
            type: 0,
            allow: (
                FluxerPermissions.VIEW_CHANNEL |
                FluxerPermissions.READ_MESSAGE_HISTORY |
                FluxerPermissions.SEND_MESSAGES
            ).toString(),
        },
    ]
}

// ---------------------------------------------------------------------------
// Official server setup
// ---------------------------------------------------------------------------

async function setupOfficial(rest: FluxerRest, guildId: string, botId: string) {
    const M = buildMessages().official

    const roles = await rest.listGuildRoles(guildId)
    const channels = await rest.listGuildChannels(guildId)
    const everyoneId = guildId // Fluxer's @everyone role ID equals the guild ID, same as Discord's

    console.log('Creating roles...')

    const keeper = await getOrCreateRole(rest, guildId, roles, {
        name: 'keeper',
        color: C.ember,
        hoist: true,
        permissions: FluxerPermissions.ADMINISTRATOR,
    })
    const tender = await getOrCreateRole(rest, guildId, roles, {
        name: 'tender',
        color: C.deepEmber,
        hoist: true,
        permissions:
            FluxerPermissions.MANAGE_MESSAGES |
            FluxerPermissions.KICK_MEMBERS |
            FluxerPermissions.MODERATE_MEMBERS,
    })
    await getOrCreateRole(rest, guildId, roles, { name: 'ember', color: C.warmOrange })
    await getOrCreateRole(rest, guildId, roles, { name: 'guest', color: C.ash })
    await getOrCreateRole(rest, guildId, roles, {
        name: 'hearth',
        color: C.charcoal,
        permissions: FluxerPermissions.SEND_MESSAGES | FluxerPermissions.EMBED_LINKS,
    })

    await rest.updateGuildRole(guildId, everyoneId, {
        permissions: (
            FluxerPermissions.VIEW_CHANNEL |
            FluxerPermissions.READ_MESSAGE_HISTORY |
            FluxerPermissions.SEND_MESSAGES
        ).toString(),
    })

    console.log('Creating channels...')

    const catStart = await getOrCreateCategory(rest, guildId, channels, '📌 start here')
    const catUpdates = await getOrCreateCategory(rest, guildId, channels, '🔔 updates')
    const catCommunity = await getOrCreateCategory(rest, guildId, channels, '🔥 community')
    const catSupport = await getOrCreateCategory(rest, guildId, channels, '🛠 support')

    const welcome = await getOrCreateChannel(
        rest,
        guildId,
        channels,
        'welcome',
        catStart,
        readonlyOverwrites(everyoneId, keeper.id),
    )
    const rules = await getOrCreateChannel(
        rest,
        guildId,
        channels,
        'rules',
        catStart,
        readonlyOverwrites(everyoneId, keeper.id),
    )
    const announcements = await getOrCreateChannel(
        rest,
        guildId,
        channels,
        'announcements',
        catUpdates,
        readonlyOverwrites(everyoneId, keeper.id),
    )
    await getOrCreateChannel(
        rest,
        guildId,
        channels,
        'changelog',
        catUpdates,
        readonlyOverwrites(everyoneId, keeper.id),
    )
    await getOrCreateChannel(rest, guildId, channels, 'general', catCommunity)
    const showcase = await getOrCreateChannel(rest, guildId, channels, 'showcase', catCommunity)
    const help = await getOrCreateChannel(
        rest,
        guildId,
        channels,
        'help',
        catSupport,
        readonlyOverwrites(everyoneId, tender.id),
    )
    const bugReports = await getOrCreateChannel(rest, guildId, channels, 'bug-reports', catSupport)
    await getOrCreateChannel(
        rest,
        guildId,
        channels,
        'mod-logs',
        catSupport,
        staffOnlyOverwrites(everyoneId, tender.id),
    )

    console.log('Posting messages...')

    const helpContent = `Common setup issues:

1. ${s('status')} \`on\` gives an error: make sure the bot is installed to your apps. Install link in <#${welcome.id}>.
2. Not getting DMs: run ${s('notify')} \`on\`. The other person also needs ${s('status')} \`on\`.
3. Your circle can't see you: they need to run ${s('status')} \`on\` and join the hearth server too.

For reproducible bugs, post in <#${bugReports.id}>.`

    await pinOrUpdate(rest, welcome, botId, M.welcome)
    await pinOrUpdate(rest, rules, botId, M.rules)
    await pinOrUpdate(rest, help, botId, helpContent)
    await pinOrUpdate(rest, bugReports, botId, M.bugReportTemplate)

    const annPins = await rest.listPinnedMessages(announcements.id)
    if (annPins.length === 0)
        await rest.sendMessage(announcements.id, 'Announcements will appear here.')

    const showcasePins = await rest.listPinnedMessages(showcase.id)
    if (showcasePins.length === 0) await rest.sendMessage(showcase.id, M.showcase)

    const guild = await rest.getGuild(guildId)
    const ownerMember = await rest.getGuildMember(guildId, guild.owner_id)
    if (!ownerMember.roles.includes(keeper.id)) {
        await rest.addGuildMemberRole(guildId, guild.owner_id, keeper.id)
        console.log(`Assigned keeper to ${ownerMember.user.username}`)
    }
    console.log(
        'Move the bot\'s role above "keeper" in server settings before users can be assigned it.',
    )
}

// ---------------------------------------------------------------------------
// Dev server setup
// ---------------------------------------------------------------------------

async function setupDev(rest: FluxerRest, guildId: string, botId: string) {
    const M = buildMessages().dev

    const roles = await rest.listGuildRoles(guildId)
    const channels = await rest.listGuildChannels(guildId)
    const everyoneId = guildId

    console.log('Creating roles...')

    const architect = await getOrCreateRole(rest, guildId, roles, {
        name: 'architect',
        color: C.ember,
        hoist: true,
        permissions: FluxerPermissions.ADMINISTRATOR,
    })
    const maintainer = await getOrCreateRole(rest, guildId, roles, {
        name: 'maintainer',
        color: C.deepEmber,
        hoist: true,
        permissions: FluxerPermissions.MANAGE_MESSAGES,
    })
    await getOrCreateRole(rest, guildId, roles, { name: 'spark', color: C.warmOrange })
    await getOrCreateRole(rest, guildId, roles, { name: 'tester', color: C.coolGrey })
    await getOrCreateRole(rest, guildId, roles, {
        name: 'hearth [dev]',
        color: C.ashGrey,
        permissions: FluxerPermissions.SEND_MESSAGES | FluxerPermissions.EMBED_LINKS,
    })

    await rest.updateGuildRole(guildId, everyoneId, {
        permissions: (
            FluxerPermissions.VIEW_CHANNEL |
            FluxerPermissions.READ_MESSAGE_HISTORY |
            FluxerPermissions.SEND_MESSAGES
        ).toString(),
    })

    console.log('Creating channels...')

    const catMeta = await getOrCreateCategory(rest, guildId, channels, '📌 meta')
    const catDev = await getOrCreateCategory(rest, guildId, channels, '🔨 development')
    const catTesting = await getOrCreateCategory(rest, guildId, channels, '🧪 testing')
    const catBots = await getOrCreateCategory(rest, guildId, channels, '🤖 bots')

    const devNotes = await getOrCreateChannel(rest, guildId, channels, 'dev-notes', catMeta)
    const roadmap = await getOrCreateChannel(
        rest,
        guildId,
        channels,
        'roadmap',
        catMeta,
        readonlyOverwrites(everyoneId, architect.id),
    )
    await getOrCreateChannel(
        rest,
        guildId,
        channels,
        'commits',
        catDev,
        readonlyOverwrites(everyoneId, maintainer.id),
    )
    await getOrCreateChannel(
        rest,
        guildId,
        channels,
        'pull-requests',
        catDev,
        readonlyOverwrites(everyoneId, maintainer.id),
    )
    await getOrCreateChannel(
        rest,
        guildId,
        channels,
        'issues',
        catDev,
        readonlyOverwrites(everyoneId, maintainer.id),
    )
    const botTesting = await getOrCreateChannel(rest, guildId, channels, 'bot-testing', catTesting)
    const presenceLab = await getOrCreateChannel(
        rest,
        guildId,
        channels,
        'presence-lab',
        catTesting,
    )
    await getOrCreateChannel(
        rest,
        guildId,
        channels,
        'logs',
        catTesting,
        readonlyOverwrites(everyoneId, maintainer.id),
    )
    await getOrCreateChannel(rest, guildId, channels, 'hearth-dev', catBots)

    console.log('Posting messages...')

    await pinOrUpdate(rest, devNotes, botId, M.devNotes)
    await pinOrUpdate(rest, roadmap, botId, M.roadmap)
    await pinOrUpdate(rest, botTesting, botId, M.botTesting)
    await pinOrUpdate(rest, presenceLab, botId, M.presenceLab)

    const guild = await rest.getGuild(guildId)
    const ownerMember = await rest.getGuildMember(guildId, guild.owner_id)
    if (!ownerMember.roles.includes(architect.id)) {
        await rest.addGuildMemberRole(guildId, guild.owner_id, architect.id)
        console.log(`Assigned architect to ${ownerMember.user.username}`)
    }
    console.log(
        'Move the bot\'s role above "architect" in server settings before users can be assigned it.',
    )
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main() {
    const rest = new FluxerRest(config.FLUXER_TOKEN, config.FLUXER_API_BASE_URL)

    const guild = await rest.getGuild(guildId).catch(() => null)
    if (!guild) {
        console.error(`Guild ${guildId} not found. Is the bot in that server?`)
        process.exit(1)
    }
    console.log(`Setting up ${serverType} server: ${guild.name}`)

    try {
        if (serverType === 'official') {
            await setupOfficial(rest, guildId, config.CLIENT_ID)
        } else {
            await setupDev(rest, guildId, config.CLIENT_ID)
        }
        console.log('Done.')
    } catch (err) {
        console.error('Setup failed:', err)
        process.exit(1)
    }
}

main()
