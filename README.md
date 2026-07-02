<div align="center">
  <img src="assets/hearth-banner-github.png" width="100%" alt="hearth - appear online only to your circle">
  <br><br>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D22.12.0-green.svg" alt="Node.js 22.12+">
  <br><br>
  <em>Appear online only to your support circle. Invisible to everyone else.</em>
</div>

---

> **This is a Fluxer port of [hearth](https://github.com/MPZ-00/hearth)**, forked rather than
> built as a shared abstraction. Fluxer has no official docs or client SDK yet, everything this
> bot relies on was verified directly against the [fluxerapp/fluxer](https://github.com/fluxerapp/fluxer)
> source. Read **[PORTING.md](PORTING.md)** for what's confirmed vs. assumed.
>
> **Slash commands don't work yet.** Fluxer has no interaction/slash-command system as of this
> writing, so the commands described below aren't reachable in-app. The rest of this README
> describes hearth's intended behavior, parked and waiting on Fluxer's own command API. Once
> that lands, this note is the only thing that needs updating.

---

## What is hearth?

Fluxer shows your status to everyone you share a server with, and to all your friends. There's no built-in way to say "I'm here, but only for certain people."

Hearth fixes that. Turn it on and you're visible to a small circle you choose. To everyone else, you look offline.

## How it works

Fluxer only syncs presence between users who share a server. Hearth manages a private server whose membership is your circle. Run `/status on` and the bot sends you a one-time invite to join. Once you're in, your circle members can see your real status natively. Run `/status off` and the bot removes you from the server. You disappear.

If you enable `/notify on`, you'll get a DM when someone in your circle comes online.

### Bring your own server

Don't want to rely on the shared hearth server? Run `/host invite` to get a link that adds hearth to a server you already control, with zero permissions requested. The moment it joins, that server becomes its own private circle: anyone who's a member there and opted in with `/status on` is mutually visible to everyone else in it. No setup, no claiming step required.

### What hearth cannot do

If you share other servers with someone, or they're on your friends list, Fluxer will still show them your status. Hearth controls who is in one private server, not Fluxer's presence system directly. For full invisibility, use Fluxer's built-in invisible mode.

---

## Self-hosting

### Prerequisites

- Node.js 22.12.0+
- A Fluxer application with a bot user and bot token
- A private Fluxer server to use as your hearth server (optional, users can also bring their own via `/host`, see below)

Fluxer has no privileged-intent system, unlike Discord: member and presence events reach the bot unfiltered, so there's no separate approval step to enable them.

### Installation

```bash
git clone <this repository>
cd hearth-fluxer
npm install
cp .env.example .env
```

### Configuration

Edit `.env`:

```
FLUXER_TOKEN=your_bot_token
CLIENT_ID=your_application_id
HEARTH_GUILD_ID=your_private_server_id
HEARTH_INVITE_CHANNEL_ID=your_invite_channel_id
DB_PATH=./data/hearth.db
```

`HEARTH_GUILD_ID` and `HEARTH_INVITE_CHANNEL_ID` are optional. Leave them unset if you only want users bringing their own server via `/host`.

### Running

```bash
npm run dev        # development, with live reload
npm start          # production (after npm run build)
```

Command registration (`npm run deploy` in the discord.js version) is on hold until Fluxer has a command API to register against, see the note at the top of this file.

### Generate your install link

Users add hearth to their Fluxer accounts, not to a server. Fluxer's OAuth2 install-link format isn't confirmed yet (see PORTING.md), so this section will fill in once it is.

### Setting up your hearth server (optional, shared mode)

1. Create a new Fluxer server. Keep it private and disable the default invite link.
2. Invite the bot (needs permission to create invites and kick members).
3. Copy the server ID into `HEARTH_GUILD_ID`, and a text channel ID into `HEARTH_INVITE_CHANNEL_ID`, in your `.env`.
4. When someone runs `/status on`, the bot generates a one-time invite and sends it to them so they can join.

Skip this section entirely if you'd rather have users bring their own server via `/host invite` (zero bot permissions required). Both modes can run side by side.

---

## Commands

| Command | Description |
|---|---|
| `/status on` | Get a one-time invite to the hearth server so your circle can see you |
| `/status off` | Leave the hearth server and go offline to everyone |
| `/add @user` | Add someone to your circle |
| `/remove @user` | Remove someone from your circle |
| `/list` | Show your current circle |
| `/notify on` | Get a DM when a circle member activates hearth |
| `/notify off` | Turn off notifications |
| `/host invite` | Get a zero-permission link to add hearth to a server you control |
| `/host claim` | Manually register the current server as a circle gate (usually automatic) |
| `/host unclaim` | Stop using the current server as a circle gate |

---

If hearth is useful to you, consider [sponsoring the original project](https://github.com/sponsors/MPZ-00) to help keep it going.

---

## Contributing

Issues and PRs welcome. Open an issue before starting something large so we can talk through the approach first.

## License

[MIT](LICENSE)
