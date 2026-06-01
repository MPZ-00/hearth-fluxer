import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from '../src/config';

const commands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Toggle your hearth presence visibility')
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('on = visible to your circle, off = invisible to everyone')
        .setRequired(true)
        .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' }),
    )
    .setDMPermission(true)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add someone to your support circle')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to add').setRequired(true),
    )
    .setDMPermission(true)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove someone from your support circle')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to remove').setRequired(true),
    )
    .setDMPermission(true)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('list')
    .setDescription('Show your current support circle')
    .setDMPermission(true)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('notify')
    .setDescription('Get a DM when a circle member comes online')
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('on = notify me, off = no notifications')
        .setRequired(true)
        .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' }),
    )
    .setDMPermission(true)
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

(async () => {
  console.log('Registering slash commands...');
  await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: commands });
  console.log('Done. Commands registered globally.');
})();
