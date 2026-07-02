# Porting notes: hearth to Fluxer

Forked from [hearth](https://github.com/MPZ-00/hearth) (discord.js). Fluxer
(fluxerapp/fluxer) has no official docs or client SDK yet, so everything here
was verified by reading the Fluxer source directly. This file separates what's
confirmed from what's assumed so nobody mistakes a guess for a fact later.

## Confirmed (read directly from fluxerapp/fluxer source)

- No intents system exists (no `GatewayIntentBits` anywhere in the repo). Bots
  receive member/presence/guild events unfiltered, with no privileged-intent
  approval process.
- No slash-command/interaction system exists yet (no `ApplicationCommand` or
  `InteractionType` anywhere in the repo, as of this port). Slash commands are
  reportedly coming to Fluxer, which is why `src/commands/*.ts` and the deploy
  scripts are parked rather than deleted, see below.
- Gateway opcodes match Discord's numbering exactly, in
  `packages/constants/src/GatewayConstants.ts`.
- Gateway dispatch event name strings (`GUILD_MEMBER_ADD`, `PRESENCE_UPDATE`,
  `MESSAGE_CREATE`, etc.) match Discord's exactly, in
  `fluxer_api/src/api/constants/Gateway.ts`.
- IDENTIFY/RESUME/HEARTBEAT payload shapes come from `fluxer_app/.../GatewaySocket.ts`.
  IDENTIFY carries a `flags` bitfield instead of `intents`.
- REST endpoints, verified route-by-route:
  - `GET /gateway/bot`, in `fluxer_api/src/api/gateway/GatewayController.ts`
  - `GET /guilds/:guild_id/members` and `GET/DELETE /guilds/:guild_id/members/:user_id`,
    in `fluxer_api/src/api/guild/controllers/GuildMemberController.ts`
  - `GET /guilds/:guild_id/roles`, in `GuildRoleController.ts`
  - `POST /channels/:channel_id/invites` (body: `max_uses`, `max_age`, `unique`,
    `temporary`) and `GET/DELETE /invites/:invite_code`, in
    `fluxer_api/src/api/invite/InviteController.ts`
- Response field shapes (snake_case, same as Discord): `GuildMemberResponse`,
  `UserPartialResponse`, `GuildInviteMetadataResponse` in `packages/schema`.
  Notably `roles` on a member is an array of role **IDs**, not names.

## Assumed: Discord-parity guesses, not verified against source

Confirm these before depending on them in anything real:

- `GET /guilds/:guild_id/invites` (list guild invites), used by `inviteCache.ts`.
- `GET /users/:user_id`, `POST /users/@me/channels` (DM creation), and
  `POST /channels/:channel_id/messages` (send), used by `notification.ts`,
  `kickQueue.ts` admin alerts, and `presenceUpdate.ts`.
- Invite URL scheme (`https://fluxer.app/invite/{code}`) in `status.ts`.
- Activity/presence type numbers (0 = Playing, etc.) in `activity.ts`/`client.ts`.
- `PRESENCE_UPDATE` and `GUILD_MEMBER_ADD`/`REMOVE` dispatch payload field
  names in `fluxer/types.ts`: the event *names* are confirmed, the payload
  *shapes* are Discord-shaped guesses.

## Parked

Fluxer has no interaction/slash-command system as of this port, but one is
reportedly coming. Rather than delete the discord.js-shaped command layer,
these files are kept as reference and excluded from the build
(see `tsconfig.json`) until there's a real Fluxer command API to target:

- `src/commands/*.ts` and `src/bot/handlers/interactionCreate.ts`
- `scripts/deploy-commands.ts`, `scripts/deploy-dev-commands.ts`
- `scripts/setup-server.ts` (600 lines of Discord-specific channel/role/automod
  provisioning; likely needs a from-scratch rewrite once Fluxer's equivalent
  resources are known, but kept in case parts are reusable)

Each parked file has a `TODO(fluxer-commands)` banner at the top. The active
handler in the meantime is `bot/handlers/messageCreate.ts`, a stub for
prefix-based text commands.

## Known structural changes from the discord.js version

- No local guild/member cache. discord.js kept `guild.members.cache` warm from
  the gateway; this port has no cache layer, so anything that used to read the
  cache (co-location checks, observer role lookup, ghost-member detection) now
  makes REST calls instead. That's fine at hearth's scale, but it does mean one
  REST call per candidate user on every join, see `guildMemberAdd.ts` and
  `whitelist.ts`.
- `config.HEARTH_INVITE_CHANNEL_ID` is now required explicitly. The discord.js
  version auto-picked "first text channel" via `guild.channels.cache`. No
  channel-list REST endpoint is wired up yet, so this scaffold asks for the
  channel ID directly instead.

## Next steps

1. Verify the "assumed" endpoints above against a real Fluxer instance or
   further source reading, and fix any that are wrong.
2. Once Fluxer ships its command API: check whether it matches Discord's
   interaction shape closely enough to adapt `src/commands/*.ts` in place, or
   whether `messageCreate.ts`'s prefix-command approach is still the better
   fit in the meantime.
3. Decide whether `scripts/setup-server.ts` is worth rebuilding at all before
   doing it.
