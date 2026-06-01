import { Events } from 'discord.js';
import { config } from './config';
import { db } from './db/client';
import { hearthGuilds } from './db/schema';
import { createClient } from './bot/client';
import { handleInteractionCreate } from './bot/handlers/interactionCreate';
import { handleGuildMemberAdd } from './bot/handlers/guildMemberAdd';
import { handleGuildMemberRemove } from './bot/handlers/guildMemberRemove';
import { handlePresenceUpdate } from './bot/handlers/presenceUpdate';

const client = createClient();

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);

  // In self-hosted mode, register the configured guild as the hearth guild
  if (config.HEARTH_GUILD_ID) {
    db.insert(hearthGuilds)
      .values({ guildId: config.HEARTH_GUILD_ID })
      .onConflictDoNothing()
      .run();
    console.log(`Hearth guild: ${config.HEARTH_GUILD_ID}`);
  }
});

client.on(Events.InteractionCreate, handleInteractionCreate);
client.on(Events.GuildMemberAdd, handleGuildMemberAdd);
client.on(Events.GuildMemberRemove, handleGuildMemberRemove);
client.on(Events.PresenceUpdate, handlePresenceUpdate);

client.login(config.DISCORD_TOKEN);
