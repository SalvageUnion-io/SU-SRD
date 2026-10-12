/**
 * An entity's STATS as facts: the head's cells and the page's stat column.
 * Ported from component-lib's `referenceEntityStatsConfig.ts`, which now
 * builds its `StatItem`s from these.
 */

import {
  getBioSalvageValue,
  getCargoCapacity,
  getEnergyPoints,
  getHeatCapacity,
  getHitPoints,
  getModuleSlots,
  getSalvageValue,
  getSlotsRequired,
  getStructurePoints,
  getSystemSlots,
  getUpgradeCost,
  getUpkeepCost,
} from '../../entityFields.js'
import type { SURefEnumSchemaName, SURefMetaEntity } from '../../schemas/index.js'
import type { Fact } from '../types.js'

type StatConfig = {
  getter: (data: SURefMetaEntity) => number | undefined
  /** The full name, two words: a full-size value box sets one per line. */
  label: string
  /** The game's own abbreviation; absent where the first word already is one. */
  short?: string
  /** As the Workshop Manual's stat column prints it ("Structure Pts."). */
  book: string
  hint: string
  /** Kept by a primary-only cluster. */
  primary?: true
}

/** Every stat, in the head's order. */
const STATS: StatConfig[] = [
  {
    getter: getSlotsRequired,
    book: 'Slots Required',
    label: 'Slots Required',
    hint: 'The number of slots required to install this System or Module on a Mech.',
  },
  {
    getter: getStructurePoints,
    book: 'Structure Pts.',
    label: 'Structure Points',
    short: 'SP',
    hint: 'Structure Points represent how tough and sturdy your Mech is, and how much damage it can take. This is an abstract measure representing a broad range of factors ranging from sheer bulk and armour to wider defensive capabilities.',
    primary: true,
  },
  {
    getter: getHitPoints,
    book: 'Hit Pts.',
    label: 'Hit Points',
    short: 'HP',
    hint: 'Hit Points are an abstract measure of how resilient your Pilot and NPCs are. This can represent a wide variety of different factors, including their ability to mitigate harm and defend themselves, their general toughness, as well as good fortune.',
  },
  {
    getter: getEnergyPoints,
    book: 'Energy Pts.',
    label: 'Energy Points',
    short: 'EP',
    hint: 'Energy Points abstractly represents the energy output and efficiency of your Mechs reactor as well as its stored power. You can spend these points to activate your Systems, Modules, and Chassis Abilities.',
    primary: true,
  },
  {
    getter: getSalvageValue,
    book: 'Salvage Value',
    label: 'Salvage Value',
    short: 'SV',
    hint: "Salvage Value represents the sum of a Mech, System, or Module's material components. As such it's the amount of Scrap you receive when breaking down a Chassis, System, or Module, as well as the amount of Scrap required to craft a Mech, System, or Module.",
    primary: true,
  },
  {
    getter: getBioSalvageValue,
    book: 'Bio-Salvage Value',
    label: 'Bio SV',
    hint: 'Bio Salvage Value represents the biological material that can be harvested from this creature or NPC.',
    primary: true,
  },
  {
    getter: getSystemSlots,
    book: 'System Slots',
    label: 'System Slots',
    short: 'SYS',
    hint: 'Each System has a System Slot value which represents how much space it takes up on a Mech, conversely a Mechs System Slot value represents how many Systems it can mount. This is an abstract value that covers not only size, but energy requirements, ammo storage and a host of other factors.',
  },
  {
    getter: getModuleSlots,
    book: 'Module Slots',
    label: 'Module Slots',
    short: 'MODS',
    hint: "Each Module has a Module Slot value which represents how much space it takes up on a Mech, conversely a Mech's Module Slot value represents how many Modules it can mount.",
  },
  {
    getter: getCargoCapacity,
    book: 'Cargo Cap.',
    label: 'Cargo Capacity',
    hint: "A Mech's Cargo Slots represents how much it can carry. By default a Mech has 6 Cargo Slots. Cargo Capacity can be increased by installing Systems such as Transport Holds or Cargo Bays into your Mech, as well as from some unique Chassis and Pilot Abilities.",
  },
  {
    getter: getHeatCapacity,
    book: 'Heat Cap.',
    label: 'Heat Capacity',
    hint: 'Your Mech generates Heat when you activate some Systems and Modules or when you Push your reactor, its Heat Capacity represents its ability to operate under these conditions. If you reach your Heat Capacity your reactor will be at risk of overloading, with potentially catastrophic results.',
    primary: true,
  },
  // A Union Crawler's economy (Workshop Manual p.218): only
  // `crawler-tech-levels` carries these.
  {
    getter: getUpkeepCost,
    book: 'Upkeep Cost',
    label: 'Upkeep Cost',
    hint: "Upkeep Cost is the Scrap of the Union Crawler's own Tech Level you must pay each Downtime to keep it running. Pay it in full and the same amount goes into your Upgrade Pool; fail to pay and the Crawler deteriorates.",
  },
  {
    getter: getUpgradeCost,
    book: 'Upgrade Cost',
    label: 'Upgrade Cost',
    hint: 'Upgrade Cost is the Upgrade Pool total that unlocks the next Tech Level. The pool fills from the Upkeep you pay (and any extra Scrap you add during Downtime); the upgrade itself then takes one week. The maximum tech level has no upgrade cost, so it shows none.',
  },
]

/** The first word of a label: the short form where the stat has no other. */
function firstWord(label: string): string {
  return label.split(' ')[0] ?? label
}

/** A stat's value, or `undefined` when absent or zero (zeros are not printed). */
function statValue(
  config: StatConfig,
  entity: SURefMetaEntity,
  schemaName: SURefEnumSchemaName | 'actions' | undefined
): string | undefined {
  let value = config.getter(entity)
  // Bio-Titans yield bio-salvage equal to their Structure Points (core-book
  // rule); there is no stored field, so it is derived here and nowhere else.
  if (value === undefined && config.getter === getBioSalvageValue && schemaName === 'bio-titans') {
    value = getStructurePoints(entity)
  }
  return value === undefined || value === 0 ? undefined : `${value}`
}

/**
 * The entity's stats, in the head's order. On a Bio tech-level entity the
 * salvage value is its BIO-SALVAGE value.
 */
export function entityStats(
  entity: SURefMetaEntity,
  options: { schemaName?: SURefEnumSchemaName | 'actions'; techLevel?: number | 'B' | 'N' }
): Fact[] {
  const isBio = options.techLevel === 'B'
  return STATS.flatMap((config, index): Fact[] => {
    const value = statValue(config, entity, options.schemaName)
    if (value === undefined) return []
    const bio = isBio && config.getter === getSalvageValue
    return [
      {
        key: `ref-stat-${index}`,
        label: bio ? 'BIO-SALVAGE VALUE' : config.label,
        short: bio ? 'Bio' : (config.short ?? firstWord(config.label)),
        value,
        hint: config.hint,
        ...(config.primary ? { primary: true as const } : {}),
      },
    ]
  })
}

/** The Tech Level as a fact, keyed as the head's TL cell. */
export function techLevelFact(techLevel: number | 'B' | 'N'): Fact {
  return { key: 'tech-level', label: 'Tech Level', short: 'TL', value: String(techLevel) }
}

/**
 * The book's stat column order: STRUCTURE PTS., ENERGY PTS., HEAT CAP., SYSTEM
 * SLOTS, MODULE SLOTS, CARGO CAP., TECH LEVEL, SALVAGE VALUE, with the stats
 * the chassis spread does not print taking their places around it.
 */
const BOOK_ORDER: StatConfig['getter'][] = [
  getSlotsRequired,
  getStructurePoints,
  getHitPoints,
  getEnergyPoints,
  getHeatCapacity,
  getSystemSlots,
  getModuleSlots,
  getCargoCapacity,
  // TECH LEVEL sits here, between CARGO CAP. and SALVAGE VALUE.
  getSalvageValue,
  getBioSalvageValue,
  getUpkeepCost,
  getUpgradeCost,
]

const TECH_LEVEL_INDEX = BOOK_ORDER.indexOf(getSalvageValue)

/** The page's stat column: every stat, in the book's order and words. */
export function bookStats(
  entity: SURefMetaEntity,
  options: { schemaName?: SURefEnumSchemaName | 'actions'; techLevel?: number | 'B' | 'N' }
): Fact[] {
  const { techLevel } = options
  const out: Fact[] = []
  BOOK_ORDER.forEach((getter, index) => {
    if (index === TECH_LEVEL_INDEX && techLevel != null) out.push(techLevelFact(techLevel))
    const config = STATS.find((c) => c.getter === getter)
    if (!config) return
    const value = statValue(config, entity, options.schemaName)
    if (value === undefined) return
    const label =
      getter === getSalvageValue && techLevel === 'B' ? 'Bio-Salvage Value' : config.book
    out.push({
      key: `book-${config.book}`,
      label,
      short: config.short ?? firstWord(config.label),
      value,
      hint: config.hint,
    })
  })
  return out
}
