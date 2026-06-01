import { Client, GatewayIntentBits, Partials } from 'discord.js';

export function createClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,    // privileged; required for Layer A join/leave
      GatewayIntentBits.GuildPresences,  // privileged; required for presenceUpdate
      GatewayIntentBits.DirectMessages,
    ],
    // Partials.Channel is required to receive DMs from users not yet in the bot's cache
    partials: [Partials.Channel],
  });
}
