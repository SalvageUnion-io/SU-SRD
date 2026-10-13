/**
 * The book's starting builds: the five patterns the Core Book tags as a legal
 * Tech 1 build for a starting Mech, read off the stored `legalStarting` data
 * tag. The card's labels, a page's pattern rows and its band all say it the
 * same way.
 */

import type { SURefObjectAnyPattern } from 'salvageunion-reference'
import { isLegalStartingPattern } from 'salvageunion-reference/rules'

/** The stamp a pattern the book sanctions as a starting build wears. */
export const LEGAL_STARTING_PATTERN = 'Legal Starting Pattern'

/**
 * The book's own words for it, printed under each of the five such patterns
 * (Salvage Union Core Book pp.101, 103, 105, 107, 109).
 */
export const LEGAL_STARTING_PATTERN_NOTE =
  'This Pattern is a legal Tech 1 build for a starting Mech if you are new to the game.'

/**
 * Whether a pattern carries the stored `legalStarting` data tag — a Bio-Titan
 * pattern never does. Never computed from tech level or salvage value.
 */
export function isLegalStartingPatternOf(pattern: SURefObjectAnyPattern | undefined): boolean {
  return !!pattern && 'legalStarting' in pattern && isLegalStartingPattern(pattern.legalStarting)
}
