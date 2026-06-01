import { Events } from 'discord.js';
import { config } from './config';
import { db } from './db/client';
import { hearthGuilds } from './db/schema';
import { createClient } from './bot/client';
import { handleInteractionCreate } from './bot/handlers/interactionCreate';
import { handleGuildMemberAdd } from './bot/handlers/guildMemberAdd';
import { handleGuildMemberRemove } from './bot/handlers/guildMemberRemove';
import { handlePresenceUpdate } from './bot/handlers/presenceUpdate';
import { initInviteCache, trackInviteCreate } from './bot/inviteCache';
import { initObserverCache } from './bot/observerCache';
import { logger } from './logger';

const client = createClient();

client.once(Events.ClientReady, async (c) => {
  logger.info(`Logged in as ${c.user.tag}`);

  if (config.HEARTH_GUILD_ID) {
    db.insert(hearthGuilds)
      .values({ guildId: config.HEARTH_GUILD_ID })
      .onConflictDoNothing()
      .run();
    logger.info(`Hearth guild: ${config.HEARTH_GUILD_ID}`);
    await initInviteCache(c, config.HEARTH_GUILD_ID);
    logger.debug('Invite cache initialised');
  }

  if (config.OBSERVER_GUILD_ID) {
    await initObserverCache(c, config.OBSERVER_GUILD_ID, config.OBSERVER_ROLE);
  }
});

client.on(Events.InteractionCreate, handleInteractionCreate);
client.on(Events.GuildMemberAdd, handleGuildMemberAdd);
client.on(Events.GuildMemberRemove, handleGuildMemberRemove);
client.on(Events.PresenceUpdate, handlePresenceUpdate);
client.on(Events.InviteCreate, (invite) => {
  if (invite.guild) trackInviteCreate(invite.guild.id, invite.code);
});

client.login(config.DISCORD_TOKEN);
