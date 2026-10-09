import { query } from './_generated/server'
import { BUILD_FLOOR } from './buildFloor'

/**
 * The build floor: a client whose own stamp (`VITE_BUILD_STAMP`) is older than
 * this was built before the backend it is talking to, and may call a function
 * that no longer exists or send a shape that is now refused.
 *
 * Unauthenticated on purpose — a signed-out tab is just as stale — and it
 * reveals nothing but a commit time. Every client subscribes once
 * (`ConnectionProvider`), so a push re-runs the query and every open tab hears
 * the new floor at once: it stops writing and reloads onto the new build
 * (`src/lib/connection/buildFloor.ts`).
 */
export const floor = query({ args: {}, handler: async (): Promise<number> => BUILD_FLOOR })
