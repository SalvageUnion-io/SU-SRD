import type { SURefEntity } from 'salvageunion-reference'
import {
  SalvageUnionReference,
  getPatterns,
  getSalvageValue,
  getTechLevelNumber,
  normalizePatternName,
} from 'salvageunion-reference'
import type { PatternOverrideData } from './referenceEntityDisplayTypes'

type PatternItem = { name: string; count?: number }

/**
 * Resolve the full pattern data record for a given pattern override name.
 * Returns undefined if the entity is not a chassis or no match is found.
 */
export function resolvePatternOverride(
  data: SURefEntity,
  patternOverride: PatternOverrideData
): ReturnType<typeof getPatterns> extends (infer T)[] | undefined ? T | undefined : never {
  const patterns = getPatterns(data)
  if (!patterns) return undefined
  const normalizedOverride = normalizePatternName(patternOverride.name)
  return patterns.find((p) => normalizePatternName(p.name) === normalizedOverride)
}

/** Sum SV * TL for a list of pattern items (systems or modules). */
function sumItemTL1(
  items: PatternItem[],
  lookup: (name: string) => SURefEntity | undefined
): number {
  let total = 0
  for (const item of items) {
    const entity = lookup(item.name)
    if (entity) {
      const count = item.count ?? 1
      total += (getSalvageValue(entity) ?? 0) * (getTechLevelNumber(entity) ?? 1) * count
    }
  }
  return total
}

/**
 * Compute TL1-equivalent salvage value for a pattern override.
 * Returns { value, bottomLabel } for display, or undefined if not applicable.
 */
export function computeSvOverride(
  data: SURefEntity,
  patternOverride: PatternOverrideData
): { value: number; bottomLabel: string } {
  const chassisSV = getSalvageValue(data) ?? 0
  const chassisTL = getTechLevelNumber(data) ?? 1
  let totalTL1 = chassisSV * chassisTL
  totalTL1 += sumItemTL1(patternOverride.systems, (name) =>
    SalvageUnionReference.Systems.find((s) => s.name === name)
  )
  totalTL1 += sumItemTL1(patternOverride.modules, (name) =>
    SalvageUnionReference.Modules.find((m) => m.name === name)
  )
  return { value: totalTL1, bottomLabel: 'TL1' }
}
