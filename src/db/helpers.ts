import { eq } from 'drizzle-orm'
import { db } from './client'
import { users } from './schema'

export function upsertUser(id: string): void {
    db.insert(users).values({ id }).onConflictDoNothing().run()
}

export function getUser(id: string) {
    return db.select().from(users).where(eq(users.id, id)).get()
}
