/**
 * `cloudflare:workers` exists only inside workerd. The Worker's tests import
 * `src/worker/index.ts`, which exports the rooms and the bot's gateway, so
 * under `bun test` the module is this stand-in; the rooms' wiring is tested
 * inside workerd (`src/worker/__workerd__/`).
 */
import { mock } from 'bun:test'

mock.module('cloudflare:workers', () => ({
  exports: {},
  DurableObject: class {
    constructor(
      readonly ctx: unknown,
      readonly env: unknown
    ) {}
  },
  WorkerEntrypoint: class {
    constructor(
      readonly ctx: unknown,
      readonly env: unknown
    ) {}
  },
}))
