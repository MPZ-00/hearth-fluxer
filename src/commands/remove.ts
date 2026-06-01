import type { ChatInputCommandInteraction } from 'discord.js';
import { isInCircle, removeFromCircle } from '../services/whitelist';

export async function execute(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user', true);

  if (!isInCircle(interaction.user.id, target.id)) {
    await interaction.reply({
      content: `**${target.displayName}** isn't in your circle.`,
      ephemeral: true,
    });
    return;
  }

  removeFromCircle(interaction.user.id, target.id);

  await interaction.reply({
    content: `Removed **${target.displayName}** from your circle.`,
    ephemeral: true,
  });
}
