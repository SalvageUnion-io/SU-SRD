/**
 * Mech patterns and faction formations: reading a chassis's patterns, the
 * hidden-pattern rule that every render surface funnels through, pattern-name
 * normalisation, and resolving a formation member to its entity.
 *
 * Split out of the old `lib/utilities.ts` grab bag; still re-exported from
 * there (and from the package barrel), so this is an internal home, not a new
 * public surface.
 */

import { SalvageUnionReference } from './index.js'
import type {
  SURefEntity,
  SURefMetaEntity,
  SURefObjectFormationMech,
  SURefObjectPattern,
} from './types/index.js'

/**
 * Extract patterns from an entity
 * @param entity - The entity to extract from
 * @returns The patterns or undefined
 */

export function getPatterns(entity: SURefMetaEntity): SURefObjectPattern[] | undefined {
  return 'patterns' in entity && Array.isArray(entity.patterns)
    ? visiblePatterns(entity.patterns)
    : undefined
}

/**
 * A HIDDEN pattern carries the stored `hidden` data flag — an explicit tag,
 * NEVER computed from source (project data convention; mirrors
 * `legalStarting`). The record stays in the dataset but is withheld from
 * every rendered surface. Takes the primitive the rule reads — the record's
 * `hidden` value (undefined = untagged = visible).
 */

export function isHiddenPattern(hidden: boolean | undefined): boolean {
  return hidden === true
}

/**
 * Drops the stored-`hidden` set from a chassis's patterns. This is the single
 * choke point every render surface goes through, so a pattern tagged `hidden`
 * cannot leak into a card, a generated page, a wizard picker or a bot embed.
 */

export function visiblePatterns<T extends { hidden?: boolean }>(patterns: readonly T[]): T[] {
  return patterns.filter((pattern) => !isHiddenPattern(pattern.hidden))
}

/**
 * Normalize pattern name by removing " Pattern" suffix
 * @param patternName - The pattern name to normalize
 * @returns The normalized pattern name
 */

export function normalizePatternName(patternName: string): string {
  // Equivalent to `patternName.replace(/\s+Pattern$/i, '')` without that
  // regex's quadratic backtracking on a long whitespace run (the engine
  // retried `\s+` from every position before failing the `Pattern$` literal).
  //
  // Semantics preserved exactly, including the sharp edges:
  //   - no trailing-whitespace tolerance — "Iron Pattern  " is UNCHANGED,
  //     because the suffix must sit at the very end of the string. (A
  //     `trimEnd()`-first rewrite would wrongly strip it.)
  //   - `\s+` requires at least one separator, so bare "Pattern" is UNCHANGED.
  //   - the `i` flag's casing rules are kept by reusing an `i`-flag regex for
  //     the literal rather than hand-rolling `toLowerCase()`, which differs on
  //     characters like `İ` and `ſ`.
  if (!/Pattern$/i.test(patternName)) {
    return patternName
  }
  const suffixStart = patternName.length - 'Pattern'.length
  let cut = suffixStart
  while (cut > 0 && /\s/.test(patternName.charAt(cut - 1))) {
    cut--
  }

  // No whitespace before the literal (e.g. "IronPattern") -> no match.
  return cut === suffixStart ? patternName : patternName.slice(0, cut)
}

/**
 * Resolve a formation member to its entity, supporting chassis+pattern and standalone entity types.
 * For chassis: resolves chassis and optionally its pattern.
 * For other schemas (vehicles, drones, squads, npcs): resolves by name.
 * @param member - The formation member from faction data
 * @returns The resolved entity (with optional pattern for chassis), or undefined
 */

export function resolveFormationMember(
  member: SURefObjectFormationMech
): { entity: SURefEntity; pattern?: SURefObjectPattern } | undefined {
  const schemaName = member.schema ?? 'chassis'

  if (schemaName === 'chassis') {
    const chassis = SalvageUnionReference.findIn('chassis', (c) => c.name === member.chassis)
    if (!chassis) return undefined

    if (member.pattern) {
      const patterns = getPatterns(chassis)
      if (patterns) {
        const normalizedInput = normalizePatternName(member.pattern)
        const pattern = patterns.find((p) => normalizePatternName(p.name) === normalizedInput)
        if (pattern) return { entity: chassis, pattern }
      }
    }

    // Chassis found but pattern missing or not matched — still return the chassis
    return { entity: chassis }
  }

  // Non-chassis entity types: look up by name in the given schema
  const found = SalvageUnionReference.findIn(
    schemaName,
    (e) => 'name' in e && e.name === member.chassis
  )
  return found ? { entity: found } : undefined
}
