/** The words of Play's Downtime steps and crafting (ADR-054), apart from play.ts to keep it within the file-size limit. */

import { messages } from './define'

export const playDowntimeCopy = messages({
  nothingToTally: 'You carry no Scrap home: nothing to tally.',
  applyAndGoOn: 'Apply and go on',
  skipThisStep: 'Skip this step',
  skipStepN: 'Skip step {n}',
  stepApplied: 'Applied: {step}',
  stepUndone: 'Undid: {step}',
  uncrafted: 'Took back {name}: its Scrap is in the pool again.',
})
