import type { GuildMember, PartialGuildMember } from 'discord.js'
import { eq, and, or } from 'drizzle-orm'
import { db } from '../../db/client'
import { hearthGuilds, whitelist, users, pendingInvites } from '../../db/schema'
import { pruneOrphanedGuildJoinEntries } from '../../services/whitelist'
import { config } from '../../config'

export async function handleGuildMemberRemove(member: GuildMember | PartialGuildMember) {
    const hearthGuild = db
        .select({ guildId: hearthGuilds.guildId })
        .from(hearthGuilds)
        .where(eq(hearthGuilds.guildId, member.guild.id))
        .get()

    if (!hearthGuild) return

    if (member.guild.id !== config.HEARTH_GUILD_ID) {
        // Member may still share another hearth guild, so only drop now-orphaned entries.
        pruneOrphanedGuildJoinEntries(member.client, member.id)
        return
    }

    // Legacy guild is the only gate, so leaving it means losing it entirely.
    db.delete(whitelist)
        .where(
            and(
                eq(whitelist.source, 'guild_join'),
                or(eq(whitelist.ownerId, member.id), eq(whitelist.memberId, member.id)),
            ),
        )
        .run()

    // Clear any pending invite they hadn't used
    db.delete(pendingInvites).where(eq(pendingInvites.userId, member.id)).run()

    // Sync DB state; an external kick shouldn't leave opted_in=true
    db.update(users)
        .set({ optedIn: false, updatedAt: Math.floor(Date.now() / 1000) })
        .where(and(eq(users.id, member.id), eq(users.optedIn, true)))
        .run()
}
