import { MessageFlags, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js'
import { config } from '../config'
import { claimGuild, isClaimed, unclaimGuild } from '../services/host'

async function reply(interaction: ChatInputCommandInteraction, content: string) {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral })
}

export async function execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand()

    if (sub === 'invite') {
        const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${config.CLIENT_ID}&scope=bot+applications.commands&permissions=0`
        await reply(
            interaction,
            `Add hearth to a server you control: ${inviteUrl}\nNo permissions needed. It claims itself as a circle gate as soon as it joins.`,
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
        const claimed = claimGuild(interaction.guildId!)
        const message = claimed
            ? 'This server is now a hearth circle gate. Members who join become mutually visible.'
            : 'This server is already a hearth circle gate.'
        await reply(interaction, message)
        return
    }

    if (sub === 'unclaim') {
        if (!isClaimed(interaction.guildId!)) {
            await reply(interaction, 'This server is not a hearth circle gate.')
            return
        }

        unclaimGuild(interaction.client, interaction.guild!)
        await reply(interaction, 'This server is no longer a hearth circle gate.')
        return
    }
}
