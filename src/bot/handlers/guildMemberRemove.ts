import type { GuildMember, PartialGuildMember } from 'discord.js';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { hearthGuilds } from '../../db/schema';
import { removeFromCircle } from '../../services/whitelist';

export async function handleGuildMemberRemove(member: GuildMember | PartialGuildMember) {
  const isHearthGuild = db
    .select({ guildId: hearthGuilds.guildId })
    .from(hearthGuilds)
    .where(eq(hearthGuilds.guildId, member.guild.id))
    .get();

  if (!isHearthGuild) return;

  // Only remove guild_join-sourced entries; command-added entries survive a guild leave.
  const existingMembers = await member.guild.members.fetch();
  for (const [id] of existingMembers) {
    if (id === member.id || id === member.client.user.id) continue;
    removeFromCircle(member.id, id, 'guild_join');
    removeFromCircle(id, member.id, 'guild_join');
  }
}
