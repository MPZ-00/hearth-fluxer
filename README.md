# hearth

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.12.0-green.svg)](https://nodejs.org)

**Appear online only to your support circle. Invisible to everyone else.**

---

## What is hearth?

Discord shows your status to everyone you share a server with, and to all your friends. There's no built-in way to say "I'm here, but only for certain people."

Hearth fixes that. Turn it on and you're visible to a small circle you choose. To everyone else, you look offline.

## How it works

Discord only syncs presence between users who share a server. Hearth manages a private server whose membership is your circle. Run `/status on` and the bot sends you a one-time invite to join. Once you're in, your circle members can see your real status natively. Run `/status off` and the bot removes you from the server. You disappear.

If you enable `/notify on`, you'll get a DM when someone in your circle comes online.

### What hearth cannot do

If you share other servers with someone, or they're on your friends list, Discord will still show them your status. Hearth controls who is in one private server, not Discord's presence system directly. For full invisibility, use Discord's built-in invisible mode.

---

## Self-hosting

### Prerequisites

- Node.js 22.12.0+
- A Discord application with a bot user ([Discord Developer Portal](https://discord.com/developers/applications))
- Privileged intents enabled in the portal: `Server Members Intent` and `Presence Intent`
- A private Discord server to use as your hearth server

### Installation

```bash
git clone https://github.com/MPZ-00/hearth.git
cd hearth
npm install
cp .env.example .env
```

### Configuration

Edit `.env`:

```
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
HEARTH_GUILD_ID=your_private_server_id
DB_PATH=./data/hearth.db
```

### Running

```bash
# Register slash commands (run once, or whenever you change commands)
npm run deploy

# Start the bot
npm run dev        # development, with live reload
npm start          # production (after npm run build)
```

### Setting up your hearth server

1. Create a new Discord server. Keep it private and disable the default invite link.
2. Invite the bot (needs `Create Instant Invite` and `Kick Members` permissions).
3. Copy the server ID into `HEARTH_GUILD_ID` in your `.env`.
4. When someone runs `/status on`, the bot generates a one-time invite and sends it to them so they can join.

---

## Commands

| Command | Description |
|---|---|
| `/status on` | Get a one-time invite to the hearth server so your circle can see you |
| `/status off` | Leave the hearth server and go offline to everyone |
| `/add @user` | Add someone to your circle |
| `/remove @user` | Remove someone from your circle |
| `/list` | Show your current circle |
| `/notify on` | Get a DM when a circle member comes online |
| `/notify off` | Turn off notifications |

---

If hearth is useful to you, consider [sponsoring](https://github.com/sponsors/MPZ-00) to help keep it going.

---

## Contributing

Issues and PRs welcome. Open an issue before starting something large so we can talk through the approach first.

## License

[MIT](LICENSE)
