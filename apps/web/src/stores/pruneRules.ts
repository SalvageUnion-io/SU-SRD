/**
 * The rule that decides whether a held row may be dropped (ADR-034, P4b).
 *
 * Pruning — dropping local rows the server did not return — is what keeps the
 * stores a reflection of Convex. It is also the most destructive operation in the codebase, and
 * the guard below is the kind that looks like defensive noise right up until
 * the day somebody removes it.
 *
 * It lives here, as a predicate, rather than inline in `ShelfSync`'s effect, so
 * that the tests assert **the rule itself** instead of a copy of it. A parallel
 * implementation in a test file is a rule that can pass while the code does the
 * opposite.
 */

import type { ContainerFields } from 'game-domain/container'
import { containerOf } from 'game-domain/container'

/**
 * May this pilot, mech or crawler be pruned, given `listMine` did not return it?
 *
 * Absence means different things in the two containers.
 *
 * A **shelf** row carries no ambiguity: `gameId: null` with no owner is the one
 * combination ADR-030 §2 calls invalid, so every shelf row is owned, and every
 * owned row is in `listMine`. Absence means deleted.
 *
 * A **Game** row is ambiguous on its own. `entities.listMine` returns what the
 * caller **owns**, wherever it lives, and a Game's unclaimed pre-gens and its
 * communal crawler have no owner at all, so they are absent from that query
 * while being entirely legitimate. A Game row is therefore pruned only when
 * `knownMine`: this browser recorded a server version for it
 * (`serverVersions.ts`), which only `listMine` or the owner's own write
 * does. Then its absence means it was deleted, or released to the crew, and in
 * both cases this browser's copy is no longer the caller's to hold — the same
 * reason `entityStore.forget` exists. The caller passes `false` for a crawler:
 * a Game's crawler is the crew's, and `WiringSync` prunes it.
 */
export function rowMayBePruned(entity: ContainerFields, knownMine: boolean): boolean {
  return knownMine || containerOf(entity).kind === 'shelf'
}
