import { SalvageUnionReference } from 'salvageunion-reference'

/** A chassis pattern as stored in salvageunion-reference (canonical data). */
export type PatternLike = {
  name: string
  systems?: { name: string }[]
  modules?: { name: string }[]
}

type ChassisWithPatterns = {
  name: string
  patterns?: PatternLike[]
}

/** Canonical patterns for the given chassis (empty when none / unchosen). */
export function patternsForChassis(chassisName: string): PatternLike[] {
  if (!chassisName) return []
  const chassis = SalvageUnionReference.Chassis.find((c) => c.name === chassisName) as unknown as
    | ChassisWithPatterns
    | undefined
  return chassis?.patterns ?? []
}
