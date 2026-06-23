import { EmbedBuilder, MessageFlags, type ChatInputCommandInteraction } from 'discord.js'
import { BOT_VERSION } from '../version'
import { config } from '../config'

export async function execute(interaction: ChatInputCommandInteraction) {
    const cmds = await interaction.client.application!.commands.fetch()

    function m(name: string): string {
        const cmd = cmds.find((c) => c.name === name)
        return cmd ? `</${name}:${cmd.id}>` : `\`/${name}\``
    }

    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${config.CLIENT_ID}&integration_type=1&scope=applications.commands`

    const embed = new EmbedBuilder()
        .setTitle('hearth')
        .setURL(inviteUrl)
        .setDescription(
            'You appear online only to the people you choose. Everyone else sees you offline.',
        )
        .addFields(
            {
                name: `${m('status')} \`on\` / \`off\``,
                value: 'Join the hearth server so your circle can see your real status, or leave and go invisible.',
            },
            {
                name: m('add'),
                value: 'Add someone to your circle.',
            },
            {
                name: m('remove'),
                value: 'Remove someone from your circle.',
            },
            {
                name: m('list'),
                value: 'Show your current circle.',
            },
            {
                name: `${m('notify')} \`on\` / \`off\``,
                value: 'Get a DM when a circle member activates hearth.',
            },
            {
                name: `${m('host')} \`invite\` / \`claim\` / \`unclaim\``,
                value: 'Use a server you control as your own hearth circle gate, instead of the shared one.',
            },
        )
        .setColor(0xe8735a)
        .setFooter({ text: `hearth ${BOT_VERSION} • Support: https://discord.gg/tA4tRYxcR6` })

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
}
