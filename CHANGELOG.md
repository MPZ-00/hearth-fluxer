# Changelog

All notable changes to hearth are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

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
