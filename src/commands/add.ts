import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js'
import { addToCircle, isInCircle } from '../services/whitelist'

export async function execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true)

    if (target.id === interaction.user.id) {
        await interaction.reply({
            content: "You can't add yourself.",
            flags: MessageFlags.Ephemeral,
        })
        return
    }

    if (isInCircle(interaction.user.id, target.id)) {
        await interaction.reply({
            content: `**${target.displayName}** is already in your circle.`,
            flags: MessageFlags.Ephemeral,
        })
        return
    }

    addToCircle(interaction.user.id, target.id, 'command')

    await interaction.reply({
        content: `Added **${target.displayName}** to your circle. They'll see your real status when hearth is on. Once they run \`/status on\` themselves, you'll see theirs too.`,
        flags: MessageFlags.Ephemeral,
    })
}
