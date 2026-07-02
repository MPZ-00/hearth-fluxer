// TODO(fluxer-commands): parked discord.js-shaped logic, not wired into the running bot.
// Fluxer has no slash-command/interaction system yet (see PORTING.md). Excluded from the
// build in tsconfig.json until Fluxer ships a command API to rewrite this against.
import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js'
import { setNotify } from '../services/status'

export async function execute(interaction: ChatInputCommandInteraction) {
    const mode = interaction.options.getString('mode', true) as 'on' | 'off'
    setNotify(interaction.user.id, mode === 'on')

    if (mode === 'on') {
        await interaction.reply({
            content:
                "Notifications on. You'll get a DM when someone in your circle activates hearth.",
            flags: MessageFlags.Ephemeral,
        })
    } else {
        await interaction.reply({
            content: 'Notifications off.',
            flags: MessageFlags.Ephemeral,
        })
    }
}
