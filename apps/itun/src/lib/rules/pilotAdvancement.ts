/**
 * Where a pilot sits on the advancement ring, resolved for a live sheet.
 *
 * The pure rules live in `salvageunion-reference/rules` (`advancement.ts`);
 * this is ITUN's app-local layer, in the shape `heatCheck.ts` established — it
 * binds those rules to a persisted `Pilot` and to the reference catalog.
 *
 * ## Derived, with the stored field as an override
 *
 * A hybrid pilot's origin is normally worked out from the trees they hold
 * abilities in rather than read from a field, because the rules make that
 * reliable: 6 Core abilities to advance, 3 of them in the gate tree the hybrid
 * grants anyway, leaving 3 that only the origin's own trees can supply.
 * `originClassRef` is consulted FIRST and wins when present, so a player's
 * explicit answer is never overruled by inference — but it stays absent on the
 * ordinary pilot.
 *
 * ## Nothing is sealed on a guess
 *
 * When the origin cannot be resolved — no abilities yet, only granted trees, or
 * a free-edited pilot whose trees point two ways at once — `sealed` is empty.
 * Closing the wrong two trees is worse than closing none, and this state is
 * reachable by a row rather than a click: the class picker has been ungated for
 * as long as it has existed, so pilots in it already exist.
 */

import type { SURefAbility, SURefClass } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { OriginInferenceState } from 'salvageunion-reference/rules'
import {
  inferOriginClass,
  liveAdvancementDataset,
  resolveAdvancementTrees,
  resolveClassRef,
} from 'salvageunion-reference/rules'

/** How the origin was arrived at — surfaced so a sheet can be honest about it. */
export type OriginSource = 'stored' | 'inferred' | 'unresolved'

export type PilotAdvancement = {
  /** Resolved class name, or undefined when `classRef` resolves to nothing. */
  className: string | undefined
  /** True when the pilot's class is one of the five Hybrid Classes. */
  isHybrid: boolean
  /** The Core class advanced out of. Undefined unless resolved. */
  origin: string | undefined
  originSource: OriginSource
  /** `'not-hybrid'` for everyone who has not advanced into a Hybrid. */
  originState: OriginInferenceState | 'not-hybrid'
  /** Trees the pilot may train NEW abilities from. */
  open: readonly string[]
  /** Trees closed to new picks. Held abilities in them are retained. */
  sealed: readonly string[]
  /** The core tree completed to advance, when known. */
  gate: string | undefined
  /** The Core classes this hybrid could have come from. */
  candidates: readonly string[]
  /** Held trees no candidate origin explains — reported, never weighted. */
  unexplainedTrees: readonly string[]
}

const NOT_ADVANCED: PilotAdvancement = {
  className: undefined,
  isHybrid: false,
  origin: undefined,
  originSource: 'unresolved',
  originState: 'not-hybrid',
  open: [],
  sealed: [],
  gate: undefined,
  candidates: [],
  unexplainedTrees: [],
}

/** The trees a pilot currently holds abilities in. */
export function heldTreesOf(abilityRefs: readonly string[]): string[] {
  if (abilityRefs.length === 0) return []
  const trees: string[] = []
  for (const ability of SalvageUnionReference.Abilities.all() as SURefAbility[]) {
    if (!abilityRefs.includes(ability.id)) continue
    if (!trees.includes(ability.tree)) trees.push(ability.tree)
  }
  return trees
}

/**
 * Resolve a pilot's advancement state.
 *
 * Requires the `classes`, `ability-tree-requirements` and `abilities` schemas to
 * be preloaded — every caller is a surface that already reads reference data.
 */
export function resolvePilotAdvancement(pilot: {
  classRef: string
  abilities: readonly string[]
  originClassRef?: string | undefined
}): PilotAdvancement {
  // `resolveClassRef` answers null, not undefined, for a ref that resolves to
  // nothing — normalised here so the guard below actually catches it.
  const cls = (resolveClassRef(pilot.classRef) ?? undefined) as SURefClass | undefined
  if (cls === undefined) return NOT_ADVANCED

  const data = liveAdvancementDataset()
  const isHybrid = 'hybrid' in cls && cls.hybrid === true

  if (!isHybrid) {
    const trees = resolveAdvancementTrees(data, undefined, cls.name)
    return {
      ...NOT_ADVANCED,
      className: cls.name,
      open: trees.open,
    }
  }

  // Stored answer first — a player's explicit choice is never second-guessed.
  const stored = pilot.originClassRef
  const storedName = stored === undefined ? undefined : resolveClassRef(stored)?.name
  const inference = inferOriginClass(data, cls.name, heldTreesOf(pilot.abilities))

  const origin = storedName ?? inference.origin
  const originSource: OriginSource =
    storedName !== undefined ? 'stored' : inference.origin !== undefined ? 'inferred' : 'unresolved'

  const trees = resolveAdvancementTrees(data, origin, cls.name)

  return {
    className: cls.name,
    isHybrid: true,
    origin: trees.originUnresolved ? undefined : origin,
    originSource: trees.originUnresolved ? 'unresolved' : originSource,
    originState: inference.state,
    open: trees.open,
    sealed: trees.sealed,
    gate: trees.gate,
    candidates: inference.candidates,
    unexplainedTrees: inference.unexplainedTrees,
  }
}
