// TODO(fluxer-commands): parked discord.js-shaped logic, not wired into the running bot.
// Fluxer has no slash-command/interaction system yet (see PORTING.md). Excluded from the
// build in tsconfig.json until Fluxer ships a command API to rewrite this against.
// Note: setOptedIn now takes a FluxerClient, not a discord.js Client.
import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js'
import { setOptedIn } from '../services/status'

export async function execute(interaction: ChatInputCommandInteraction) {
    const mode = interaction.options.getString('mode', true) as 'on' | 'off'
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const { inviteUrl } = await setOptedIn(interaction.client, interaction.user.id, mode === 'on')

    if (mode === 'on') {
        if (inviteUrl) {
            await interaction.editReply(
                `You're on. Join the hearth server to become visible to your circle (5 minutes, one use):\n${inviteUrl}`,
            )
        } else {
            await interaction.editReply("You're on. Your circle can see your real status now.")
        }
    } else {
        await interaction.editReply(
            "You're off. You appear offline to everyone, including your circle.",
        )
    }
}
