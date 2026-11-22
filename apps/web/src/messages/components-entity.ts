/** The words of apps/web/src/components/entity: the message catalogue (ADR-054). */

import { messages } from './define'

export const entityCopy = messages({
  rowRules: '{name} rules',
  techLevelN: 'Tech Level {level}',
  notShown: 'Not shown',
  openPage: 'Open page',
  close: 'Close',
  thisCardCouldNotBe: 'This card could not be drawn here.',
  rollTable: '(roll table)',
  rollTheDie: 'Roll the Die:',
  removed: 'Removed',
  redacted: 'Redacted',
  sortBy: 'Sort by {column}',
  sortByTitled: 'Sort by {column} ({title})',
  rowActions: 'Actions',
  termMeans: '{term}: what it means',
  termValueMeans: '{term}: {value}, what it means',
  termCargoCapacity: 'Cargo Capacity',
  termCargoCapacityIs:
    'How many Cargo Slots a Mech has to carry things in. A Mech has 6 unless its Chassis, a System or an Ability gives it more. A carried Chassis, System or Module fills as many Cargo Slots as its Salvage Value.',
  termSlotsRequired: 'Slots Required',
  termSlotsRequiredIs:
    'How much room this takes up on a Mech: a System fills that many of the Mech’s System Slots, a Module that many of its Module Slots.',
  termDamage: 'Damage',
  termDamageIs:
    'What a hit takes off its target: Structure Points (SP) from a Mech, Hit Points (HP) from a Pilot. A Mech takes half the damage of a weapon that deals HP; a Pilot takes double the damage of one that deals SP.',
  termInventory: 'Inventory',
  termInventoryIs:
    'What a Pilot carries on them. A Pilot starts with 6 Inventory Slots, and most Pilot Equipment fills one.',
  termTrainingPoints: 'Training Points',
  termTrainingPointsIs:
    'What a Pilot spends to train an Ability, in the Pilot Bay during Downtime: 1 for a Core Ability, 2 for an Advanced or Hybrid Class Ability, 3 for a Legendary Ability.',
})
