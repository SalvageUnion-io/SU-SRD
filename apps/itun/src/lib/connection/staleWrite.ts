import type { Value } from 'convex/values'
import { ConvexError } from 'convex/values'

/**
 * A whole-body write made against a copy the server has since moved past.
 *
 * `entities.upsertByAppId` replaces a pilot's or mech's whole body, so a write
 * from a device holding an older copy used to land and silently undo whatever
 * another device had saved in between — last writer wins, and the first writer
 * never finds out. The client now sends the row version its copy came from;
 * when the row has moved on the server refuses, and hands back the row it
 * holds so the client can show it and the player can make the change again on
 * top of it.
 *
 * Shared by `convex/` (which throws it) and the client (which reads it), the
 * way `lib/links/linkRules.ts` shares its refusal copy.
 */

/** The player-facing refusal. Neutral about who moved the row: it may have been this tab. */
export const STALE_WRITE_REFUSAL =
  'This sheet changed before your edit reached it, so the edit was not saved. It now shows the latest version — make your change again.'

/** The refusal's `ConvexError` data: the copy, plus the row the server holds. */
export type StaleWriteData = { message: string; updatedAt: number; body: Value }

/** The refusal to throw, server-side. */
export function staleWriteError(row: {
  updatedAt: number
  body: Value
}): ConvexError<StaleWriteData> {
  return new ConvexError({ message: STALE_WRITE_REFUSAL, updatedAt: row.updatedAt, body: row.body })
}

/** The server's row when `err` is a stale-write refusal, else `null`. */
export function staleWriteOf(err: unknown): StaleWriteData | null {
  if (!(err instanceof ConvexError)) return null
  const data = err.data as Partial<StaleWriteData> | null
  if (typeof data !== 'object' || data === null) return null
  if (data.message !== STALE_WRITE_REFUSAL || typeof data.updatedAt !== 'number') return null
  return { message: data.message, updatedAt: data.updatedAt, body: data.body ?? null }
}
