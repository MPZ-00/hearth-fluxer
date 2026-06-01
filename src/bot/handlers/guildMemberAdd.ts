import type { GuildMember } from 'discord.js';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { hearthGuilds } from '../../db/schema';
import { addToCircle } from '../../services/whitelist';

export async function handleGuildMemberAdd(member: GuildMember) {
  const isHearthGuild = db
    .select({ guildId: hearthGuilds.guildId })
    .from(hearthGuilds)
    .where(eq(hearthGuilds.guildId, member.guild.id))
    .get();

  if (!isHearthGuild) return;

  // Mutual whitelist: shared server membership is what makes presence visible in Discord.
  const existingMembers = await member.guild.members.fetch();
  for (const [id] of existingMembers) {
    if (id === member.id || id === member.client.user.id) continue;
    addToCircle(member.id, id, 'guild_join');
    addToCircle(id, member.id, 'guild_join');
  }
}
