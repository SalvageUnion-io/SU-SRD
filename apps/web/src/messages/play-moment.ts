/** The words of the Moment, Play's one beat (ADR-068): the message catalogue (ADR-054). */

import { messages } from './define'

export const momentCopy = messages({
  activate: 'Activate',
  roll: 'Roll',
  push: 'Push',
  apply: 'Apply',
  steps: 'Steps',
  list: 'List',
  notNow: 'Not now',
  owedHeatCheck: 'Heat Check owed',
  again: 'Again',
  putOnTheTable: 'Put on the table',
  putDidNotLand: 'That did not reach the table. Try again.',
  nothingOnTable: 'Nothing is on the table.',
  onTableNow: 'On the table: {name}',
  clear: 'Clear',
  revealAnNpc: 'Reveal an NPC: its name and kind',
  noNpcToReveal: 'No NPC on the tray.',
  aRollTable: 'A roll table',
  show: 'Show',
  showNamed: 'Show {name}',
  holdTheTable: 'Hold the table',
  tableHeld: 'The Mediator is holding the table',
  npcOnTable: 'Put on the table by the Mediator: its name and kind.',
  rollFromRolls: 'Shown to read: roll it from your Rolls',
  tableOnTable: 'Put on the table by the Mediator.',
  tableSays: '{pilot} is resolving this. Shared with the table since Activate.',
})
