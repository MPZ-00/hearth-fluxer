import { EmbedBuilder, MessageFlags, type ChatInputCommandInteraction } from 'discord.js'
import { getCircle } from '../services/whitelist'

export async function execute(interaction: ChatInputCommandInteraction) {
    const entries = getCircle(interaction.user.id)

    if (entries.length === 0) {
        await interaction.reply({
            content: 'Your circle is empty. Use `/add @user` to add someone.',
            flags: MessageFlags.Ephemeral,
        })
        return
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const lines = await Promise.all(
        entries.map(async (entry) => {
            const tag = entry.source === 'guild_join' ? '*(hearth server)*' : ''
            try {
                const user = await interaction.client.users.fetch(entry.memberId)
                return `• **${user.displayName}** (${user.tag}) ${tag}`.trim()
            } catch {
                return `• \`${entry.memberId}\` ${tag}`.trim()
            }
        }),
    )

    const embed = new EmbedBuilder()
        .setTitle('Your hearth circle')
        .setDescription(lines.join('\n'))
        .setColor(0xe8735a)
        .setFooter({ text: `${entries.length} member${entries.length === 1 ? '' : 's'}` })

    await interaction.editReply({ embeds: [embed] })
}
