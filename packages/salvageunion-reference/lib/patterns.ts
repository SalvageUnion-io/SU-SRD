/**
 * Mech patterns: reading a chassis's patterns, the hidden-pattern rule that
 * every render surface funnels through, and pattern-name normalisation.
 *
 * Split out of the old `lib/utilities.ts` grab bag. The package barrel
 * (`lib/index.ts`) re-exports the names consumers use, by name.
 */

import type { SURefMetaEntity, SURefObjectPattern } from './schemas/index.js'

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
