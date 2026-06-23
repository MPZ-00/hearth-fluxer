import { MessageFlags, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js'
import { config } from '../config'
import { claimGuild, getClaim, unclaimGuild } from '../services/host'

async function reply(interaction: ChatInputCommandInteraction, content: string) {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral })
}

export async function execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand()

    if (sub === 'invite') {
        const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${config.CLIENT_ID}&scope=bot+applications.commands&permissions=0`
        await reply(
            interaction,
            `Add hearth to a server you control: ${inviteUrl}\nNo special permissions needed. Once it joins, run \`/host claim\` in that server.`,
        )
        return
    }

    if (!interaction.inGuild()) {
        await reply(interaction, 'This command only works in a server.')
        return
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await reply(interaction, 'Manage Server permission required.')
        return
    }

    if (sub === 'claim') {
        const result = claimGuild(interaction.guildId!, interaction.user.id)
        const messages = {
            claimed:
                'This server is now a hearth circle gate. Members who join become mutually visible.',
            'already-claimed-by-you': 'You already claimed this server.',
            'already-claimed-by-other':
                'This server is already claimed by someone else. Ask them to run `/host unclaim` first.',
        }
        await reply(interaction, messages[result.status])
        return
    }

    if (sub === 'unclaim') {
        const claim = getClaim(interaction.guildId!)
        if (!claim) {
            await reply(interaction, 'This server is not claimed.')
            return
        }

        unclaimGuild(interaction.client, interaction.guild!)
        await reply(interaction, 'This server is no longer a hearth circle gate.')
        return
    }
}
