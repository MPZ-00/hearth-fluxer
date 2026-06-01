import type { Config } from 'drizzle-kit';

const dbPath = process.env.DB_PATH ?? './data/hearth.db';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: { url: dbPath },
} satisfies Config;
