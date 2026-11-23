/** The words of the Rules key, and what a Play key says when it cannot act (r8 A7). */

import { messages } from './define'

export const playKeysCopy = messages({
  keyTell: 'Tell the table',
  keyRollNpc: 'Roll the open NPC action’s die',
  keyNextSide: 'Move initiative on to the next side',
  keyRules: 'Search the Rules',
  keyRulesCap: 'Ctrl K · ⌘K',
  keyNotYourTurn: 'It is not your turn: there is no turn to end.',
  keyNoActionOpen: 'No action is open: press / to find one, then Use.',
  keyNothingToRoll: 'This action cannot roll now: its note says why.',
  keyNothingToApply: 'Nothing to apply yet: roll the die first, or Cancel.',
})
