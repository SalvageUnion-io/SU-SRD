import type { PatternItem, TypedPatternRow } from '../types/common'
import type { MechSourcePattern } from './mechUtils'
import { referencePatternToItems } from './builderUtils'
import { findChassisById } from './entityHelpers'

/**
 * Build a frequency map of "schema_name::schema_ref_id" → count.
 * Ignores sort_order so reordering doesn't count as deviation.
 */
function buildFrequencyMap(items: PatternItem[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = `${item.schema_name}::${item.schema_ref_id}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

/**
 * Compare two sets of pattern items by frequency (ignoring sort_order).
 * Returns true if the mech items differ from the source items.
 */
export function hasDeviated(mechItems: PatternItem[], sourceItems: PatternItem[]): boolean {
  const mechMap = buildFrequencyMap(mechItems)
  const sourceMap = buildFrequencyMap(sourceItems)

  if (mechMap.size !== sourceMap.size) return true

  for (const [key, count] of mechMap) {
    if (sourceMap.get(key) !== count) return true
  }

  return false
}

/**
 * Resolve a source pattern to its canonical PatternItem[].
 * - Player pattern: uses pattern.pattern_items
 * - Reference pattern: parses "chassisRef::patternName", looks up via findChassisById
 * Returns null if the source can't be resolved.
 */
export function resolveSourcePatternItems(
  source: MechSourcePattern,
  playerPattern?: TypedPatternRow | null
): PatternItem[] | null {
  if (source.kind === 'player') {
    return playerPattern?.pattern_items ?? null
  }

  // Reference pattern: parse "chassisRef::patternName"
  const separatorIndex = source.refPatternId.indexOf('::')
  if (separatorIndex === -1) return null

  const chassisRef = source.refPatternId.slice(0, separatorIndex)
  const patternName = source.refPatternId.slice(separatorIndex + 2)

  const chassis = findChassisById(chassisRef)
  if (!chassis?.patterns) return null

  const pattern = chassis.patterns.find((p) => p.name === patternName)
  if (!pattern) return null

  return referencePatternToItems(pattern.systems, pattern.modules)
}
