/**
 * The words of apps/web/src/build/dash's item rows (`itemRows`): the message
 * catalogue (ADR-054). Their own, apart from the sheet's: a reference page
 * draws a pattern's loadout with them, and must not download the sheet's.
 */

import { messages } from './define'

export const buildDashCopy = messages({
  tl: 'TL',
  techLevel: 'Tech Level',
  uses: 'Uses',
  cost: 'Cost',
  activationCost: 'Activation cost',
  spendEpFor: 'Spend {ep} EP for {name}',
  action: 'Action',
  rng: 'RNG',
  range: 'Range',
  dmg: 'DMG',
  damage: 'Damage',
})
