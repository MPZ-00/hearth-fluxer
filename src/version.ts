import { execSync } from 'child_process'
import pkg from '../package.json'

function shortHash(): string {
    try {
        return execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: 'pipe' }).trim()
    } catch {
        return ''
    }
}

const hash = shortHash()

export const BOT_VERSION = hash ? `v${pkg.version} (${hash})` : `v${pkg.version}`
