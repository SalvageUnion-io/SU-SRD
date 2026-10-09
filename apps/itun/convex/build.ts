import { query } from './_generated/server'
import { BUILD_FLOOR } from './buildFloor'

/**
 * The build floor (`buildFloor.ts`). A client built with a lower floor than
 * this is older than its backend, and may call a function that no longer
 * exists or send a shape that is now refused.
 *
 * Unauthenticated on purpose — a signed-out tab is just as stale — and it
 * reveals nothing but a number. Every client subscribes once
 * (`ConnectionProvider`). So a push that raises the floor re-runs the query,
 * and every open tab below it hears at once: it stops writing and reloads onto
 * the new build (`src/lib/connection/buildFloor.ts`).
 */
export const floor = query({ args: {}, handler: async (): Promise<number> => BUILD_FLOOR })
