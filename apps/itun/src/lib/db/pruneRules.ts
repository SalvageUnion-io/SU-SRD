/**
 * The two rules that decide whether a cached row may be deleted (ADR-034, P4b).
 *
 * Pruning — dropping local rows the server did not return — is what finally
 * makes "IndexedDB is a reflection of Convex" literally true rather than
 * aspirational. It is also the most destructive operation in the codebase, and
 * both guards below are the kind that look like defensive noise right up until
 * the day somebody removes one.
 *
 * They live here, as predicates, rather than inline in `ShelfSync`'s effect, so
 * that the tests assert **the rule itself** instead of a copy of it. A parallel
 * implementation in a test file is a rule that can pass while the code does the
 * opposite.
 */

import type { ContainerFields } from '../container'
import { containerOf } from '../container'
import type { LegacyProbeState } from './legacyLocalData'

/**
 * May this browser prune at all?
 *
 * Only when it has never held a pre-ADR-034 roster.
 *
 * The scenario this exists for: a long-standing Solo player signs in for the
 * first time and has not claimed yet. Every build they own is a local shelf row
 * the server has never heard of, so {@link rowMayBePruned} would read every one
 * of them as "deleted elsewhere" and delete the lot. `absent` is the only state
 * in which a local row can be trusted to have come from a server-accepted write
 * or from `ShelfSync` itself — which is what makes absence mean deletion rather
 * than not-yet-uploaded.
 *
 * `unknown` is refused for the same reason it keeps the local backend: the
 * probe has not answered, so "no legacy roster" is not yet known to be true.
 */
export function mayPrune(legacy: LegacyProbeState): boolean {
  return legacy === 'absent'
}

/**
 * May this row be pruned, given the server did not return it?
 *
 * Only shelf rows, and the asymmetry is not caution — it is that absence means
 * different things in the two containers.
 *
 * `entities.listMine` returns what the caller **owns**, wherever it lives. A
 * Game's unclaimed pre-gens and its communal crawler have no owner at all, and
 * `GameRoster` caches them on purpose, so they are absent from that query while
 * being entirely legitimate. Pruning against their absence would empty every
 * Game view on the next boot.
 *
 * A shelf row carries no such ambiguity: `gameId: null` with no owner is the one
 * combination ADR-030 §2 calls invalid, so every shelf row is owned, and every
 * owned row is in `listMine`.
 *
 * Reads the container through `containerOf` rather than testing `gameId`
 * directly, so a record written before the split — which still resolves through
 * `workspaceId` — is classified the way every other reader classifies it.
 */
export function rowMayBePruned(entity: ContainerFields): boolean {
  return containerOf(entity).kind === 'shelf'
}
