/**
 * pilotAbilities — pilot ability reference-data lookup, kept beside
 * PilotSheetItems.tsx (which stays a components-only module). Slug-tolerant so
 * seeded pilots that store kebab ability slugs still resolve.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefAbility } from 'salvageunion-reference'

import { matchesRef } from '../../lib/rules/resolveRefs'

/** Resolve a stored ability ref (slug, id, or name) to its SRD entity. */
export function resolveAbility(slug: string): SURefAbility | null {
  const all = SalvageUnionReference.Abilities.all()
  // Slug-tolerant (matchesRef): seeded pilots store kebab ability slugs.
  return all.find((a) => matchesRef(a, slug)) ?? null
}
