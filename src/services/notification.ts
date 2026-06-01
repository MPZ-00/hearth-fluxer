import type { Client } from 'discord.js';
import { getNotifyWatchers } from './whitelist';

export async function notifyCircle(client: Client, userId: string, displayName: string) {
  const watchers = getNotifyWatchers(userId);
  if (watchers.length === 0) return;

  await Promise.allSettled(
    watchers.map(async ({ ownerId }) => {
      try {
        const user = await client.users.fetch(ownerId);
        await user.send(`✶ **${displayName}** is available.`);
      } catch {
        // User may have DMs closed; silently skip
      }
    }),
  );
}
