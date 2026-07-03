import { SalvageUnionReference } from 'salvageunion-reference'

import { matchesRef } from '../../lib/rules/resolveRefs'

/** A chassis pattern as stored in salvageunion-reference (canonical data). */
export type PatternLike = {
  name: string
  systems?: { name: string }[]
  modules?: { name: string }[]
}

type ChassisWithPatterns = {
  id: string
  name: string
  patterns?: PatternLike[]
}

/** Canonical patterns for the given chassis ref (empty when none / unchosen). */
export function patternsForChassis(chassisName: string): PatternLike[] {
  if (!chassisName) return []
  const chassis = SalvageUnionReference.Chassis.find((c) =>
    matchesRef(c, chassisName)
  ) as unknown as ChassisWithPatterns | undefined
  return chassis?.patterns ?? []
}
