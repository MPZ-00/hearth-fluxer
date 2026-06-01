import type { ChatInputCommandInteraction } from 'discord.js';
import { setOptedIn } from '../services/status';

export async function execute(interaction: ChatInputCommandInteraction) {
  const mode = interaction.options.getString('mode', true) as 'on' | 'off';
  await interaction.deferReply({ ephemeral: true });

  const { inviteUrl } = await setOptedIn(interaction.client, interaction.user.id, mode === 'on');

  if (mode === 'on') {
    if (inviteUrl) {
      await interaction.editReply(
        `**Hearth is on.** Join your hearth server to become visible to your circle:\n${inviteUrl}\n\n*(This link expires in 5 minutes and can only be used once.)*`,
      );
    } else {
      await interaction.editReply(
        '**Hearth is on.** Your circle can now see your real status when you share the hearth server with them.',
      );
    }
  } else {
    await interaction.editReply(
      '**Hearth is off.** You appear offline to everyone, including your circle.',
    );
  }
}
