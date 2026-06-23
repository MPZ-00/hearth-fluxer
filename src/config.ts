import * as fs from 'fs'
import * as path from 'path'

function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) continue
            const eq = trimmed.indexOf('=')
            if (eq === -1) continue
            const key = trimmed.slice(0, eq).trim()
            const val = trimmed.slice(eq + 1).trim()
            if (!(key in process.env)) process.env[key] = val
        }
    }
}

function requireEnv(key: string): string {
    const val = process.env[key]
    if (!val) throw new Error(`Missing required env var: ${key}`)
    return val
}

loadEnv()

export const config = {
    DISCORD_TOKEN: requireEnv('DISCORD_TOKEN'),
    CLIENT_ID: requireEnv('CLIENT_ID'),
    HEARTH_GUILD_ID: process.env.HEARTH_GUILD_ID ?? '',
    DB_PATH: process.env.DB_PATH ?? './data/hearth.db',
    // Optional: guild to pull observer role from; defaults to hearth guild
    OBSERVER_GUILD_ID: process.env.OBSERVER_GUILD_ID ?? process.env.HEARTH_GUILD_ID ?? '',
    OBSERVER_ROLE: process.env.OBSERVER_ROLE ?? 'tester',
    // Optional: channel to receive admin alerts (failed kicks, etc.)
    ADMIN_CHANNEL_ID: process.env.ADMIN_CHANNEL_ID ?? '',
    // Optional: guild to register /dev commands in (guild-scoped, instant)
    DEV_GUILD_ID: process.env.DEV_GUILD_ID ?? '',
} as const
