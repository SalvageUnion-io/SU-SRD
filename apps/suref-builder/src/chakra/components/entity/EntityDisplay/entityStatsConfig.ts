import type { SURefMetaEntity } from 'salvageunion-reference'
import {
  getSlotsRequired,
  getSalvageValue,
  getStructurePoints,
  getEnergyPoints,
  getHeatCapacity,
  getSystemSlots,
  getModuleSlots,
  getCargoCapacity,
  getHitPoints,
} from 'salvageunion-reference'

export interface StatConfig {
  /** Getter function to extract stat value from entity */
  getter: (data: SURefMetaEntity) => number | undefined
  /** Label for compact mode */
  compactLabel: string
  /** Label for normal mode */
  normalLabel: string
  /** Bottom label for compact mode (empty string to hide) */
  compactBottomLabel: string
  /** Bottom label for normal mode */
  normalBottomLabel: string
  /** Tooltip text explaining what this stat represents */
  tooltip?: string
}

/**
 * Configuration for all entity stats displayed in EntityStats component.
 * Order matters - stats will be rendered in this order.
 */
export const ENTITY_STATS_CONFIG: StatConfig[] = [
  {
    getter: getSlotsRequired,
    compactLabel: 'Slots',
    normalLabel: 'Slots',
    compactBottomLabel: '',
    normalBottomLabel: 'Required',
    tooltip: 'The number of slots required to install this System or Module on a Mech.',
  },
  {
    getter: getStructurePoints,
    compactLabel: 'SP',
    normalLabel: 'Structure',
    compactBottomLabel: '',
    normalBottomLabel: 'Points',
    tooltip:
      'Structure Points represent how tough and sturdy your Mech is, and how much damage it can take. This is an abstract measure representing a broad range of factors ranging from sheer bulk and armour to wider defensive capabilities.',
  },
  {
    getter: getHitPoints,
    compactLabel: 'HP',
    normalLabel: 'Hit',
    compactBottomLabel: '',
    normalBottomLabel: 'Points',
    tooltip:
      'Hit Points are an abstract measure of how resilient your Pilot and NPCs are. This can represent a wide variety of different factors, including their ability to mitigate harm and defend themselves, their general toughness, as well as good fortune.',
  },
  {
    getter: getEnergyPoints,
    compactLabel: 'EP',
    normalLabel: 'Energy',
    compactBottomLabel: '',
    normalBottomLabel: 'Points',
    tooltip:
      'Energy Points abstractly represents the energy output and efficiency of your Mechs reactor as well as its stored power. You can spend these points to activate your Systems, Modules, and Chassis Abilities.',
  },
  {
    getter: getSalvageValue,
    compactLabel: 'SV',
    normalLabel: 'Salvage',
    compactBottomLabel: '',
    normalBottomLabel: 'Value',
    tooltip:
      "Salvage Value represents the sum of a Mech, System, or Module's material components. As such it's the amount of Scrap you receive when breaking down a Chassis, System, or Module, as well as the amount of Scrap required to craft a Mech, System, or Module.",
  },
  {
    getter: getSystemSlots,
    compactLabel: 'Sys',
    normalLabel: 'System',
    compactBottomLabel: 'Slts',
    normalBottomLabel: 'Slots',
    tooltip:
      'Each System has a System Slot value which represents how much space it takes up on a Mech, conversely a Mechs System Slot value represents how many Systems it can mount. This is an abstract value that covers not only size, but energy requirements, ammo storage and a host of other factors.',
  },
  {
    getter: getModuleSlots,
    compactLabel: 'Mod',
    normalLabel: 'Module',
    compactBottomLabel: 'Slts',
    normalBottomLabel: 'Slots',
    tooltip:
      "Each Module has a Module Slot value which represents how much space it takes up on a Mech, conversely a Mech's Module Slot value represents how many Modules it can mount.",
  },
  {
    getter: getCargoCapacity,
    compactLabel: 'Crgo',
    normalLabel: 'Cargo',
    compactBottomLabel: 'Cap',
    normalBottomLabel: 'Capacity',
    tooltip:
      "A Mech's Cargo Slots represents how much it can carry. By default a Mech has 6 Cargo Slots. Cargo Capacity can be increased by installing Systems such as Transport Holds or Cargo Bays into your Mech, as well as from some unique Chassis and Pilot Abilities.",
  },
  {
    getter: getHeatCapacity,
    compactLabel: 'Heat',
    normalLabel: 'Heat',
    compactBottomLabel: 'Cap',
    normalBottomLabel: 'Capacity',
    tooltip:
      'Your Mech generates Heat when you activate some Systems and Modules or when you Push your reactor, its Heat Capacity represents its ability to operate under these conditions. If you reach your Heat Capacity your reactor will be at risk of overloading, with potentially catastrophic results.',
  },
]

/**
 * Apply label formatting (prefix, zero handling)
 */
export function applyStatLabel(
  value: number | string | undefined,
  prefix: string = ''
): string | undefined {
  if (value === undefined) return undefined
  if (value === 0) return '-'
  return `${prefix}${value}`
}
