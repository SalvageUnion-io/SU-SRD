import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

/**
 * The rooms' Durable Object wiring inside workerd (`bun run test:workerd`): RPC, migrations under `blockConcurrencyWhile`, eviction. Their
 * logic is tested under `bun test` (`src/rooms/__tests__/`).
 */
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
    }),
  ],
  test: { include: ['workerd/*.workerd.ts'] },
})
