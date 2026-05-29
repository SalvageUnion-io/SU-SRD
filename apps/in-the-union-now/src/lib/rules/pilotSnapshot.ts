/**
 * Pilot snapshot enrichment for soft-warning evaluation.
 *
 * The `Pilot` type (from the Zod schema) stores `abilities` as `string[]`
 * (slug refs). The soft-warning system's `PilotSnapshot` expects
 * `AbilityInput[]` — structs with `ref` and an optional `minLevel`.
 *
 * `enrichPilotSnapshot` resolves `minLevel` for each ability ref from
 * `salvageunion-reference`, so `checkAbilityPrerequisites` in softWarnings.ts
 * receives the data it needs.
 *
 * NOTE: Full activation of this enrichment depends on the inline-edit flow
 * (M4 stories #225+). In the current create-only wizard, the edit snapshot
 * comparison is a no-op because `before` and `after` are identical; warnings
 * only surface when abilities change. Wire `enrichPilotSnapshot` into the
 * edit-mode `preview()` call once /pilots/$id gains inline editing.
 *
 * All functions are pure — no side effects, no async, no React.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { AbilityInput, PilotSnapshot } from './types'

/**
 * Resolve ability minLevel from salvageunion-reference by ability name/slug.
 * Returns undefined when the ability is not found (unknown ref).
 *
 * Prerequisite: SalvageUnionReference must have been preloaded with 'abilities'
 * before calling this function.
 */
function resolveAbilityMinLevel(ref: string): number | undefined {
  // Abilities are indexed by slug (id) or name. The reference stores `level`
  // as the tree-level (1 = starting). We use `level` as the minLevel proxy
  // since the SRD doesn't expose a separate prerequisite level field.
  // Note: `level` can be a string ("L" for legendary, "G" for general) in
  // some SRD entries — only numeric levels are meaningful for minLevel checks.
  const ability = SalvageUnionReference.Abilities.find((a) => a.id === ref || a.name === ref)
  const lvl = ability?.level
  return typeof lvl === 'number' ? lvl : undefined
}

/**
 * Enrich a `Pilot`-shaped object into a `PilotSnapshot` suitable for
 * `evaluateSoftWarnings`. Resolves `minLevel` for each ability from the
 * reference data.
 *
 * `level` defaults to 1 when absent (new pilots start at level 1 and the
 * current Pilot schema does not track level — deferred to a later milestone).
 */
export function enrichPilotSnapshot(pilot: { abilities: string[]; level?: number }): PilotSnapshot {
  const abilities: AbilityInput[] = pilot.abilities.map((ref) => ({
    ref,
    minLevel: resolveAbilityMinLevel(ref),
  }))
  return {
    level: pilot.level ?? 1,
    abilities,
  }
}
