import { MessageFlags, type Interaction } from 'discord.js'

type CommandModule = { execute: (i: never) => Promise<void> }

const modules: Record<string, () => Promise<CommandModule>> = {
    status: () => import('../../commands/status') as Promise<CommandModule>,
    add: () => import('../../commands/add') as Promise<CommandModule>,
    remove: () => import('../../commands/remove') as Promise<CommandModule>,
    list: () => import('../../commands/list') as Promise<CommandModule>,
    notify: () => import('../../commands/notify') as Promise<CommandModule>,
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
        const msg = { content: 'Something went wrong.', flags: MessageFlags.Ephemeral }
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(msg)
        } else {
            await interaction.reply(msg)
        }
    }
}
