import type { Value } from 'convex/values'
import { ConvexError } from 'convex/values'

/**
 * A write made against a copy the server has since moved past: an op whose
 * fields changed after its `baseSeq` (ADR-063), or a whole body older than the
 * row (`entities.upsertByAppId`). Applied, either would silently undo what
 * another device saved in between, so the server refuses and hands back the
 * row it holds; the client shows it and the player makes the change again on
 * top of it.
 *
 * Shared by `convex/` (which throws it) and the client (which reads it), the
 * way `links/linkRules.ts` shares its refusal copy.
 */

/** The player-facing refusal. Neutral about who moved the row: it may have been this tab. */
export const STALE_WRITE_REFUSAL =
  'This sheet changed before your edit reached it, so the edit was not saved. It now shows the latest version — make your change again.'

/** The refusal's `ConvexError` data: the copy, plus the row the server holds. */
type StaleWriteData = { message: string; updatedAt: number; headSeq: number; body: Value }

/** The refusal to throw, server-side. */
export function staleWriteError(row: {
  updatedAt: number
  headSeq?: number
  body: Value
}): ConvexError<StaleWriteData> {
  return new ConvexError({
    message: STALE_WRITE_REFUSAL,
    updatedAt: row.updatedAt,
    headSeq: row.headSeq ?? 0,
    body: row.body,
  })
}

/** The server's row when `err` is a stale-write refusal, else `null`. */
export function staleWriteOf(err: unknown): StaleWriteData | null {
  if (!(err instanceof ConvexError)) return null
  const data = err.data as Partial<StaleWriteData> | null
  if (typeof data !== 'object' || data === null) return null
  if (data.message !== STALE_WRITE_REFUSAL || typeof data.updatedAt !== 'number') return null
  return {
    message: data.message,
    updatedAt: data.updatedAt,
    headSeq: data.headSeq ?? 0,
    body: data.body ?? null,
  }
}
