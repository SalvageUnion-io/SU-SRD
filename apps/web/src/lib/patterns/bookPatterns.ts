/**
 * Book patterns — the patterns a chassis prints, as things a mech is built
 * from. A `legalStarting` pattern of a Tech 1 chassis goes through the guided
 * wizard; any other is built as printed, a Blank-family shortcut with no
 * budget (the same regime as a saved pattern's Build With This).
 */

import type { RefChassis } from 'salvageunion-reference'
import {
  byTechLevelThenName,
  nameToSlug,
  SalvageUnionReference,
  visiblePatterns,
} from 'salvageunion-reference'
import { isLegalCreationChassis, isLegalStartingPattern } from 'salvageunion-reference/rules'
import type { CreateInput } from '../../replica/types'
import { readReference } from '../readReference'
import type { MechPattern } from '../wizard/mechFormState'
import {
  EMPTY_MECH_FORM_STATE,
  mechFormToCreateInput,
  withPatternPrefill,
} from '../wizard/mechFormState'

/** Every chassis that prints a pattern, by Tech Level then name. */
export function chassisWithPatterns(): RefChassis[] {
  return readReference(
    'bookPatterns.chassis',
    () =>
      SalvageUnionReference.Chassis.all()
        .filter((chassis) => visiblePatterns(chassis.patterns).length > 0)
        .sort((a, b) => byTechLevelThenName(a, b)),
    []
  )
}

/** The patterns a chassis prints (hidden ones never). */
export function bookPatternsOf(chassis: RefChassis): MechPattern[] {
  return visiblePatterns(chassis.patterns)
}

/** A chassis's printed pattern by their slugs; none when either names nothing. */
export function bookPattern(
  chassisSlug: string | undefined,
  patternSlug: string | undefined
): { chassis: RefChassis; pattern: MechPattern } | undefined {
  if (chassisSlug === undefined || patternSlug === undefined) return undefined
  const chassis = readReference(
    'bookPatterns.pattern',
    () => SalvageUnionReference.Chassis.getBySlug(chassisSlug),
    undefined
  )
  const pattern = chassis
    ? bookPatternsOf(chassis).find((p) => nameToSlug(p.name) === patternSlug)
    : undefined
  return chassis && pattern ? { chassis, pattern } : undefined
}

/** Whether the guided wizard offers this pattern: a starting pattern of a Tech 1 chassis. */
export function isStartingBookPattern(chassis: RefChassis, pattern: MechPattern): boolean {
  return (
    isLegalCreationChassis(chassis.techLevel) &&
    'legalStarting' in pattern &&
    isLegalStartingPattern(pattern.legalStarting)
  )
}

/**
 * A fresh mech as the book prints the pattern: its chassis and loadout under
 * the pattern's name, pools unset (full), the pattern's drones seeded, and the
 * pattern it started from (`startingPatternRef`), as the wizard's own build.
 */
export function mechFromBookPattern(
  chassis: RefChassis,
  pattern: MechPattern
): CreateInput<'mech'> {
  return mechFormToCreateInput(
    withPatternPrefill({ ...EMPTY_MECH_FORM_STATE, chassisName: nameToSlug(chassis.name) }, pattern)
  )
}
