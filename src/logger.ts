type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 }

function resolveLevel(): Level {
    const argIdx = process.argv.indexOf('--log-level')
    if (argIdx !== -1) {
        const val = process.argv[argIdx + 1] as Level
        if (val in LEVELS) return val
    }
    const env = process.env.LOG_LEVEL as Level | undefined
    if (env && env in LEVELS) return env
    return 'info'
}

const minLevel = LEVELS[resolveLevel()]

function emit(level: Level, ...args: unknown[]): void {
    if (LEVELS[level] < minLevel) return
    const ts = new Date().toISOString()
    const line = [`[${ts}] [${level.toUpperCase()}]`, ...args]
    if (level === 'error') console.error(...line)
    else if (level === 'warn') console.warn(...line)
    else console.log(...line)
}

export const logger = {
    debug: (...args: unknown[]) => emit('debug', ...args),
    info: (...args: unknown[]) => emit('info', ...args),
    warn: (...args: unknown[]) => emit('warn', ...args),
    error: (...args: unknown[]) => emit('error', ...args),
}
