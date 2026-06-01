import type { Client, Collection, Invite } from 'discord.js';

// Per-guild: code -> uses count. Used to detect which invite was consumed on a member join.
const cache = new Map<string, Map<string, number>>();

export async function initInviteCache(client: Client, guildId: string): Promise<void> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  try {
    const invites = await guild.invites.fetch();
    cache.set(guildId, new Map(invites.map((inv) => [inv.code, inv.uses ?? 0])));
  } catch {
    // Missing Manage Guild permission or other error; cache stays empty
  }
}

export function trackInviteCreate(guildId: string, code: string): void {
  const guildCache = cache.get(guildId);
  if (guildCache) guildCache.set(code, 0);
}

/**
 * Compares fresh invite state against the cache to identify which invite was consumed.
 * maxUses=1 invites are deleted by Discord the moment they're used, so a missing code = used.
 * Updates the cache with the fresh state before returning.
 * Returns null when no consumed invite can be identified (e.g. cache miss after restart).
 */
export function findConsumedInvite(
  guildId: string,
  freshInvites: Collection<string, Invite>,
): string | null {
  const guildCache = cache.get(guildId);
  if (!guildCache) return null;

  let consumed: string | null = null;
  for (const [code] of guildCache) {
    if (!freshInvites.has(code)) {
      consumed = code;
      break;
    }
  }

  cache.set(guildId, new Map(freshInvites.map((inv) => [inv.code, inv.uses ?? 0])));
  return consumed;
}
