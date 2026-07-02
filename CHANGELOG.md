# Changelog

All notable changes to hearth-fluxer are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

Entries from 0.3.0 down are inherited from [hearth](https://github.com/MPZ-00/hearth), the discord.js project this repo was forked from. See PORTING.md for what changed in the fork itself.

## [0.1.0-alpha] - 2026-07-03

Initial public snapshot of the Fluxer port. Not usable as a working bot yet, see "Known limitations" below.

### Added

- Fluxer REST and gateway client (`src/fluxer/`), built from scratch since no official Fluxer SDK exists. Opcodes, dispatch event names, and REST endpoint shapes verified directly against fluxerapp/fluxer source
- Client, activity rotation, and entrypoint wiring ported to the new Fluxer client
- Gateway event handlers (guild create/delete, member add/remove, presence update) and caches ported to Fluxer REST calls, replacing discord.js's local member cache with direct API lookups
- Service layer (status, kick queue, notifications, host claiming, whitelist) ported to `FluxerClient`
- `PORTING.md`, a living reference separating confirmed Fluxer API details from Discord-parity assumptions still needing verification

### Known limitations

- Slash commands don't work. Fluxer has no interaction/slash-command system yet, so `/status`, `/add`, `/remove`, `/list`, `/notify`, `/host`, and `/help` aren't reachable. The original command logic is parked in `src/commands/` (excluded from the build) pending Fluxer's own command API
- Several REST endpoints are unverified Discord-parity guesses: guild invite listing, user lookup, DM creation, message sending, and the invite URL format. See "Assumed" in `PORTING.md`
- `scripts/setup-server.ts` still targets Discord's API directly and needs its own rewrite

## [0.3.0] - 2026-06-23

### Added

- `/host invite` - get a zero-permission (`permissions=0`) invite link to add hearth to a server you control
- `/host claim` / `/host unclaim` - manually register or release a server as a hearth circle gate (claiming is usually automatic)
- Auto-claim on join: any new server the bot is added to becomes its own isolated presence circle automatically, no manual step required
- `SUPPORT_SERVER_URL` config option, shown in the `/help` footer when set

### Changed

- `HEARTH_GUILD_ID` is now optional. Self-hosting a single shared guild is one option; bringing your own server via `/host` is another, and they can be used together or independently
- The mutual circle is now scoped per server instead of one global pool. Two users only become mutually visible if they actually share a hearth-claimed guild
- `hearth_guilds` no longer tracks a per-guild owner. A claimed server is its own presence circle, full stop. Anyone with Manage Server on that guild can claim or release it

## [0.2.1] - 2026-06-02

### Fixed

- Production deploy crash on startup: database migrations were not copied into `dist/`, so the migrator failed on a fresh install. The build script now copies `src/db/migrations/` to `dist/db/`

## [0.2.0] - 2026-06-02

### Added

- `/dev update` - pulls latest code, rebuilds, and restarts the bot (Administrator only, dev guild)
- Invite link in the `/help` embed title

## [0.1.0] - 2026-06-02

### Added

- Initial release: `/status on|off`, `/add`, `/remove`, `/list`, `/notify on|off`
- Private hearth guild as the presence gate; membership controls who sees your real status
