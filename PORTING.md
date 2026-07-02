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
- No auto-moderation system exists (confirmed: no AutoMod-related code anywhere
  in the repo). `scripts/setup-server.ts`'s automod section was dropped
  outright, there's nothing to rewrite it against.
- REST endpoints, verified route-by-route:
  - `GET /gateway/bot`, in `fluxer_api/src/api/gateway/GatewayController.ts`
  - `GET /guilds/:guild_id`, in `GuildBaseController.ts`
  - `GET /guilds/:guild_id/members` and `GET/DELETE /guilds/:guild_id/members/:user_id`,
    in `fluxer_api/src/api/guild/controllers/GuildMemberController.ts`
  - `PUT /guilds/:guild_id/members/:user_id/roles/:role_id`, in the same file
  - `GET /guilds/:guild_id/roles`, `POST /guilds/:guild_id/roles` (body: `name`,
    `color` as an integer, `permissions` as a stringified bitfield), and
    `PATCH /guilds/:guild_id/roles/:role_id`, in `GuildRoleController.ts`
  - `GET /guilds/:guild_id/channels` and `POST /guilds/:guild_id/channels`
    (discriminated union on `type`, with `parent_id` and `permission_overwrites`),
    in `GuildChannelController.ts`
  - `GET /channels/:channel_id/messages/pins` (returns a paginated wrapper,
    `{items: [{message, pinned_at}], has_more}`, not a bare array, this bit
    the first version of `setup-server.ts` because the route's existence was
    checked but not its actual response schema) and
    `PUT /channels/:channel_id/pins/:message_id`, in
    `MessageInteractionController.ts`
  - `POST /channels/:channel_id/invites` (body: `max_uses`, `max_age`, `unique`,
    `temporary`) and `GET/DELETE /invites/:invite_code`, in
    `fluxer_api/src/api/invite/InviteController.ts`
- Permission bitfield values (`packages/constants/src/ChannelConstants.ts`) use
  the same shift amounts as Discord's `PermissionFlagsBits` (e.g.
  `KICK_MEMBERS = 1n << 1n`, `ADMINISTRATOR = 1n << 3n`), serialized as strings
  over the wire. The `@everyone` role's ID equals the guild ID, also same as
  Discord, used in `setup-server.ts` but not independently verified as a
  general rule beyond that one usage.
- Response field shapes (snake_case, same as Discord): `GuildMemberResponse`,
  `UserPartialResponse`, `GuildInviteMetadataResponse`, `GuildRoleResponse`,
  `ChannelResponse`, `GuildResponse` in `packages/schema`. Notably `roles` on a
  member is an array of role **IDs**, not names.

## Assumed: Discord-parity guesses, not verified against source

Confirm these before depending on them in anything real:

- `GET /guilds/:guild_id/invites` (list guild invites), used by `inviteCache.ts`.
- `GET /users/:user_id`, `POST /users/@me/channels` (DM creation),
  `POST /channels/:channel_id/messages` (send), and
  `PATCH /channels/:channel_id/messages/:message_id` (edit), used by
  `notification.ts`, `kickQueue.ts` admin alerts, `presenceUpdate.ts`, and
  `setup-server.ts`'s pinned-message updates.
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

Each parked file has a `TODO(fluxer-commands)` banner at the top. The active
handler in the meantime is `bot/handlers/messageCreate.ts`, a stub for
prefix-based text commands.

`scripts/setup-server.ts` is no longer parked, it's rewritten against the
confirmed REST endpoints above. Two pieces of it still had no Fluxer target:
the automod section was deleted outright (see "Confirmed" above), and the
interactive command-mention formatting falls back to plain `` `/name` `` text
until Fluxer has a command API to fetch real command IDs from.

## Known structural changes from the discord.js version

- No local guild/member cache. discord.js kept `guild.members.cache` warm from
  the gateway; this port has no cache layer, so anything that used to read the
  cache (co-location checks, observer role lookup, ghost-member detection) now
  makes REST calls instead. That's fine at hearth's scale, but it does mean one
  REST call per candidate user on every join, see `guildMemberAdd.ts` and
  `whitelist.ts`.
- `config.HEARTH_INVITE_CHANNEL_ID` is still required explicitly in `status.ts`,
  even though `listGuildChannels` is now confirmed and used in
  `setup-server.ts`. Auto-picking "first text channel" for invite creation,
  like the discord.js version did, is a reasonable follow-up now that the
  endpoint is confirmed, just not done yet.

## Next steps

1. Verify the "assumed" endpoints above against a real Fluxer instance or
   further source reading, and fix any that are wrong.
2. Once Fluxer ships its command API: check whether it matches Discord's
   interaction shape closely enough to adapt `src/commands/*.ts` in place, or
   whether `messageCreate.ts`'s prefix-command approach is still the better
   fit in the meantime. Also revisit `setup-server.ts`'s plain-text command
   mentions at that point.
