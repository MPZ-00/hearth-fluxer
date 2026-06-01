import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as path from 'path'
import * as fs from 'fs'
import { config } from '../config'
import * as schema from './schema'

function createDb() {
    const dbPath = path.resolve(config.DB_PATH)
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const sqlite = new Database(dbPath)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')

    const db = drizzle(sqlite, { schema })
    migrate(db, { migrationsFolder: path.resolve(__dirname, 'migrations') })
    return db
}

export const db = createDb()
export type DB = typeof db
