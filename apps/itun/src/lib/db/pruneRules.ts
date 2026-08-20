/**
 * The rules that decide whether a cached row may be deleted (ADR-034, P4b).
 *
 * Pruning — dropping local rows the server did not return — is what finally
 * makes "IndexedDB is a reflection of Convex" literally true rather than
 * aspirational. It is also the most destructive operation in the codebase, and
 * every guard below is the kind that looks like defensive noise right up until
 * the day somebody removes one.
 *
 * They live here, as predicates, rather than inline in `ShelfSync`'s effect, so
 * that the tests assert **the rule itself** instead of a copy of it. A parallel
 * implementation in a test file is a rule that can pass while the code does the
 * opposite.
 */

import type { PromotionState } from '../account/promotionState'
import type { ContainerFields } from '../container'
import { containerOf } from '../container'
import type { LegacyProbeState } from './legacyLocalData'

/**
 * May this browser prune at all?
 *
 * Only when it has never held a pre-ADR-034 roster, AND no anonymous work is
 * waiting to reach the server.
 *
 * The scenario the legacy guard exists for: a long-standing Solo player signs
 * in for the first time and has not claimed yet. Every build they own is a
 * local shelf row the server has never heard of, so {@link rowMayBePruned}
 * would read every one of them as "deleted elsewhere" and delete the lot.
 * `absent` is the only state in which a local row can be trusted to have come
 * from a server-accepted write or from `ShelfSync` itself — which is what makes
 * absence mean deletion rather than not-yet-uploaded.
 *
 * `unknown` is refused for the same reason it keeps the local backend: the
 * probe has not answered, so "no legacy roster" is not yet known to be true.
 *
 * The PROMOTION guard closes the same hole from the other side, and it is the
 * one that was missing. A brand-new visitor who built anonymously and then
 * signed in has `legacy === 'absent'` — correctly, they have no pre-ADR-034
 * roster — so the first guard waves them through. But their builds are exactly
 * as un-uploaded as the long-standing player's, and if promotion has not
 * finished (or has FAILED, which leaves them local forever) then absence from
 * `listMine` means "never arrived", not "deleted elsewhere". Pruning there
 * deletes the work the promoter was reporting an error about.
 *
 * Both guards answer the same question — *can absence be trusted to mean
 * deletion?* — for the two different reasons it cannot.
 */
export function mayPrune(legacy: LegacyProbeState, promotion: PromotionState): boolean {
  return legacy === 'absent' && promotion === 'idle'
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
