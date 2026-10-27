/**
 * salvageunion.io on Workers Static Assets (ADR-033): the one Worker for the
 * whole app, `wrangler.jsonc`'s `main`. Every reference page is pre-rendered,
 * so the script runs only for the requests no file matches, and for
 * everything under `/build` and `/play` (`run_worker_first`). Astro answers
 * them, through the Cloudflare adapter, from the Worker's routes
 * (`routes.ts`); this module adds what a Worker exports beside its `fetch`:
 * the rooms, the bot's gateway and the Cron Triggers.
 */

import { handle } from '@astrojs/cloudflare/handler'
import type { ExecutionContext } from '@cloudflare/workers-types'
import { APP_BASE } from '../lib/appBase'
import { runCron } from './crons'
import type { Env } from './env'
import { SERVE } from './routes'

export { BotGateway } from './botGateway'
export { AccountRoom, GameRoom } from './rooms'

/** @public Cloudflare Worker entrypoint — loaded by workerd, not imported. */
export default {
  /** A Cron Trigger (`./crons.ts`). */
  async scheduled(controller: { cron: string; scheduledTime: number }, env: Env): Promise<void> {
    await runCron(controller.cron, env, controller.scheduledTime)
  },

  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // The app's front door is the shell's own page (`build/index.astro`), so
    // Astro would hand it to the assets as it is; the app's route reads it.
    const { pathname } = new URL(request.url)
    if (pathname === APP_BASE || pathname === `${APP_BASE}/`) return SERVE.app(request, env)
    return handle(request, env as never, ctx)
  },
}
