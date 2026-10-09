/**
 * pilotAbilities — pilot ability reference-data lookup, kept beside
 * PilotSheetItems.tsx (which stays a components-only module).
 */

import type { SURefAbility } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'

/** Resolve a stored ability slug to its SRD entity. */
export function resolveAbility(slug: string): SURefAbility | null {
  return SalvageUnionReference.Abilities.getBySlug(slug) ?? null
}
