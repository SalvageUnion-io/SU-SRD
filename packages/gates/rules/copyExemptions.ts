import type { Exemption, Finding } from '../lib/ruleEngine'
import { isExempt } from '../lib/ruleEngine'

/**
 * The copy rule's exemptions (`copyTerms.ts`): files where a lower-case term is right as written. Each is one file whose
 * flagged strings are not the app's own copy; a sentence the app writes is
 * fixed, never listed here.
 */
export const EXEMPTIONS: readonly Exemption[] = [
  {
    file: 'packages/game-domain/src/starterSet/starterSet.ts',
    rules: ['lowercase-term'],
    reason:
      'The Starter Set crew\'s backstories, mech descriptions and quirks are the book\'s own words (Reclamation of the Wastes pre-generated sheets), kept as printed: "merc pilots", "comms module", and plain English the term list also matches ("packing heat", "a wide range of utility"). game-domain cannot hold them in a `bookQuote`, which lives in salvageunion-reference.',
  },
  {
    file: 'apps/web/src/components/referenceEntity/card/choiceAnchoring.ts',
    rules: ['lowercase-term'],
    reason:
      'Its `tech level` strings are search keys matched against lower-cased block text (`blockLowerText`), never shown; capitalised they would match nothing.',
  },
  {
    file: 'packages/game-domain/src/links/linkRules.ts',
    rules: ['lowercase-term'],
    reason:
      "A thrown programming error lists the supported pairings by their type ids (`mech→pilot`), the same ids it interpolates beside them; they are identifiers, not the game's nouns.",
  },
  {
    file: 'packages/salvageunion-reference/lib/searchRanking.ts',
    rules: ['lowercase-term'],
    reason:
      'Its `ALIASES_AS_PRINTED` phrases are search keys matched lower-cased against what a reader types ("long range", "my mech hits 0 SP"), never shown as copy, and its keys are entity names as the dataset spells them (the keyword "Turn action").',
  },
]

/** The `lowercase-term` findings outside the exempt files. */
export const notExempt = (findings: readonly Finding[]): Finding[] =>
  findings.filter((f) => !isExempt(EXEMPTIONS, f.file, 'lowercase-term'))
