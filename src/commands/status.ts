import type { ChatInputCommandInteraction } from 'discord.js';
import { setOptedIn } from '../services/status';

export async function execute(interaction: ChatInputCommandInteraction) {
  const mode = interaction.options.getString('mode', true) as 'on' | 'off';
  await interaction.deferReply({ ephemeral: true });

  const { inviteUrl } = await setOptedIn(interaction.client, interaction.user.id, mode === 'on');

  if (mode === 'on') {
    if (inviteUrl) {
      await interaction.editReply(
        `You're on. Join the hearth server to become visible to your circle (5 minutes, one use):\n${inviteUrl}`,
      );
    } else {
      await interaction.editReply(
        "You're on. Your circle can see your real status now.",
      );
    }
  } else {
    await interaction.editReply(
      "You're off. You appear offline to everyone, including your circle.",
    );
  }
}
