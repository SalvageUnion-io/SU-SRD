import { join } from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

/**
 * The rooms' Durable Object wiring inside workerd (`bun run test:workerd`): RPC, migrations under `blockConcurrencyWhile`, eviction. Their
 * logic is tested under `bun test` (`src/rooms/__tests__/`). The shared
 * database's migrations ride in as `TEST_MIGRATIONS`, for a suite to apply.
 * The bot is another Worker, so its `BOT` relay is a stand-in that is never up.
 */
export default defineConfig(async () => ({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(join(import.meta.dirname, 'migrations')),
        },
        serviceBindings: { BOT: () => new Response(null, { status: 503 }) },
      },
    }),
  ],
  test: { include: ['workerd/*.workerd.ts'] },
}))
