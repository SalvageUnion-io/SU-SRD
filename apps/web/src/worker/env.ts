/** The site Worker's bindings, vars and secrets (`wrangler.jsonc`), as its routes read them. */

import type { BotRelay } from 'game-domain/botWire'
import type { AppEnv } from './app'
import type { CronEnv } from './crons'
import type { RateLimiter } from './errorReports'
import type { PhotoBucket } from './photos'
import type { SharedDb } from './shared/db'

export type Env = AppEnv &
  CronEnv & {
    /** Caps error reports per address (`wrangler.jsonc`); absent in a Preview. */
    ERROR_REPORT_LIMIT?: RateLimiter
    /** The shared D1 database; sign-in keeps accounts and sessions there (`./auth/store.ts`). */
    SHARED: SharedDb
    /** The Discord application's OAuth client, secrets both. Unset, sign-in answers 503. */
    DISCORD_CLIENT_ID?: string
    DISCORD_CLIENT_SECRET?: string
    /**
     * The origin whose `/auth/callback` Discord returns to, for a Worker
     * Preview: production's, which hands the code back (`./auth/index.ts`).
     * Unset, each origin is its own and Discord must list it.
     */
    AUTH_CALLBACK_ORIGIN?: string
    /** `'true'` only in `.dev.vars` for a test build: the test sign-in seam. */
    TEST_AUTH?: string
    /** Entity photos (R2, `./photos.ts`); unset, an upload answers 503. */
    PHOTOS?: PhotoBucket
    /** The site admins' Discord ids, comma-separated (`./auth/index.ts` `identityOf`). */
    ADMIN_DISCORD_IDS?: string
    /** The bot's relay (`wrangler.jsonc`, not on a Preview): Stop Signs and rolls post through it. */
    BOT?: BotRelay
  }
