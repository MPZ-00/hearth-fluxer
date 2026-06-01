import type { ChatInputCommandInteraction } from 'discord.js';
import { setNotify } from '../services/status';

export async function execute(interaction: ChatInputCommandInteraction) {
  const mode = interaction.options.getString('mode', true) as 'on' | 'off';
  setNotify(interaction.user.id, mode === 'on');

  if (mode === 'on') {
    await interaction.reply({
      content: "Notifications on. You'll get a DM when someone in your circle comes online.",
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: 'Notifications off.',
      ephemeral: true,
    });
  }
}
