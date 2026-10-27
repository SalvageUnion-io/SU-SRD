/**
 * A mech built from a pattern counts on it (its page's "N mechs built from
 * it"), in the room of the pattern's maker: the builder's own when it is
 * theirs, else wherever the shared database says the builder could read it
 * from, so a forged id cannot count on a pattern nobody shared with them.
 */

import type { AccountRoomLogic } from '../rooms/account/accountRoomLogic'
import { patternMakerFor } from './shared/crewPatterns'
import type { SharedDb } from './shared/db'

/** A room that may hold the pattern: counts the build and says whether it did. */
type Counter<R> = { countBuild(patternId: string, builder: string): R }

/** The pattern a new mech is built from, when the act creates one that names it. */
export function builtMech(logic: AccountRoomLogic, args: unknown): string | null {
  const { id, kind, body } = args as { id?: unknown; kind?: unknown; body?: unknown }
  if (kind !== 'mech' || typeof id !== 'string' || logic.shelf.store.unit(id) !== null) return null
  const source = (body as { sourcePattern?: unknown } | null)?.sourcePattern
  return typeof source === 'string' && source.length > 0 ? source : null
}

/** Count one build, here or in its maker's room; a failure is logged, never the builder's. */
export function countPatternBuild(
  here: Counter<boolean>,
  db: SharedDb | undefined,
  home: (maker: string) => Counter<Promise<boolean>>,
  patternId: string,
  builder: string
): void {
  const count = async () => {
    if (here.countBuild(patternId, builder)) return
    const maker = db === undefined ? null : await patternMakerFor(db, patternId, builder)
    if (maker !== null && maker !== builder) await home(maker).countBuild(patternId, builder)
  }
  count().catch((error: unknown) =>
    console.error('a pattern build went uncounted', patternId, error)
  )
}
