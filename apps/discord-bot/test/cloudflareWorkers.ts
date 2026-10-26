/**
 * `cloudflare:workers` exists only inside workerd. The Worker exports the
 * relay's `WorkerEntrypoint`, so under `bun test` the module is this
 * stand-in, as in the site's tests (`apps/web/test/cloudflareWorkers.ts`).
 */
import { mock } from 'bun:test'

mock.module('cloudflare:workers', () => ({
  WorkerEntrypoint: class {
    constructor(
      readonly ctx: unknown,
      readonly env: unknown
    ) {}
  },
}))
