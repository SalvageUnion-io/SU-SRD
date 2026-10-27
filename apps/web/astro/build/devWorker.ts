/**
 * The site Worker in dev: the Cloudflare adapter runs it in workerd inside
 * `astro dev`, its rooms and shared database local. This turns the test
 * sign-in on (`TEST_AUTH`, passed in with the process's environment) and
 * applies the shared database's migrations before the server starts. State
 * persists in `.wrangler/state/`, or `DEV_ROOMS_STATE` (`bun run dev:backend`).
 */

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'

const APP_DIR = fileURLToPath(new URL('../..', import.meta.url))

/** Where dev keeps the Worker's state, for the adapter (`persistState`) and wrangler alike. */
export const DEV_STATE = process.env.DEV_ROOMS_STATE ?? join(APP_DIR, '.wrangler/state')

export function devWorker(): AstroIntegration {
  return {
    name: 'su:dev-worker',
    hooks: {
      'astro:config:setup': ({ command }) => {
        if (command !== 'dev') return
        process.env.TEST_AUTH = 'true'
        process.env.CLOUDFLARE_INCLUDE_PROCESS_ENV = 'true'
        // The source config, not a build's (`.wrangler/deploy/config.json`).
        spawnSync(
          'bunx',
          [
            'wrangler',
            'd1',
            'migrations',
            'apply',
            'SHARED',
            '--local',
            '--config',
            'wrangler.jsonc',
            '--persist-to',
            DEV_STATE,
          ],
          { cwd: APP_DIR, stdio: ['ignore', 'inherit', 'inherit'] }
        )
      },
    },
  }
}
