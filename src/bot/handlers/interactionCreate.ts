// TODO(fluxer-commands): parked discord.js-shaped logic, not wired into index.ts.
// Fluxer has no slash-command/interaction system yet (see PORTING.md). Excluded from the
// build in tsconfig.json until Fluxer ships a command API to rewrite this against.
// messageCreate.ts is the active (stubbed) handler in the meantime.
import { MessageFlags, type Interaction, type InteractionReplyOptions } from 'discord.js'

type CommandModule = { execute: (i: never) => Promise<void> }

const modules: Record<string, () => Promise<CommandModule>> = {
    status: () => import('../../commands/status') as Promise<CommandModule>,
    add: () => import('../../commands/add') as Promise<CommandModule>,
    remove: () => import('../../commands/remove') as Promise<CommandModule>,
    list: () => import('../../commands/list') as Promise<CommandModule>,
    notify: () => import('../../commands/notify') as Promise<CommandModule>,
    host: () => import('../../commands/host') as Promise<CommandModule>,
    dev: () => import('../../commands/dev') as Promise<CommandModule>,
    help: () => import('../../commands/help') as Promise<CommandModule>,
}

export async function handleInteractionCreate(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return
    const loader = modules[interaction.commandName]
    if (!loader) return
    try {
        const { execute } = await loader()
        await execute(interaction as never)
    } catch (err) {
        console.error(`Error in /${interaction.commandName}:`, err)
        const msg: InteractionReplyOptions = {
            content: 'Something went wrong.',
            flags: MessageFlags.Ephemeral,
        }
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(msg)
        } else {
            await interaction.reply(msg)
        }
    }
}
