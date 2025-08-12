import { defineConfig } from 'drizzle-kit'
import path from 'path'

export default defineConfig({
  schema: './src/main/db/schema.ts',
  out: './src/main/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './mcp-registry.db'
  },
  verbose: true,
  strict: true,
})