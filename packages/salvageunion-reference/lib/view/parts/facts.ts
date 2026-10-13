/**
 * An entity's STATS as facts: the head's cells and the page's stat column.
 * component-lib's `referenceEntityStatsConfig.ts` builds its `StatItem`s from
 * these.
 */

import { bookQuote } from '../../bookQuote'
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
} from '../../entityFields'
import type { SURefEnumSchemaName, SURefMetaEntity } from '../../schemas/index'
import type { Fact } from '../types'

/** A stat's names, as every surface prints it: one vocabulary, read everywhere. */
export type StatLabel = {
  /** The full name, two words: a full-size value box sets one per line. */
  label: string
  /** The game's own abbreviation, or the first word where that already is one. */
  short: string
  /** As the Workshop Manual's stat column prints it ("Structure Pts."). */
  book: string
}

/**
 * Every stat's names, keyed as the data names the stat (a contribution's
 * `stat`, a getter's field). The sheet rails, the Discord bot and a pattern's
 * stat plates read these rather than spelling their own.
 */
export const STAT_LABELS = {
  slotsRequired: { label: 'Slots Required', short: 'Slots', book: 'Slots Required' },
  structurePoints: { label: 'Structure Points', short: 'SP', book: 'Structure Pts.' },
  hitPoints: { label: 'Hit Points', short: 'HP', book: 'Hit Pts.' },
  energyPoints: { label: 'Energy Points', short: 'EP', book: 'Energy Pts.' },
  salvageValue: { label: 'Salvage Value', short: 'SV', book: 'Salvage Value' },
  // "Bio-Salvage", hyphenated, as the Workshop Manual prints it (p.275).
  bioSalvageValue: { label: 'Bio SV', short: 'Bio', book: 'Bio-Salvage Value' },
  systemSlots: { label: 'System Slots', short: 'SYS', book: 'System Slots' },
  moduleSlots: { label: 'Module Slots', short: 'MODS', book: 'Module Slots' },
  cargoCapacity: { label: 'Cargo Capacity', short: 'Cargo', book: 'Cargo Cap.' },
  heatCapacity: { label: 'Heat Capacity', short: 'Heat', book: 'Heat Cap.' },
  upkeepCost: { label: 'Upkeep Cost', short: 'Upkeep', book: 'Upkeep Cost' },
  upgradeCost: { label: 'Upgrade Cost', short: 'Upgrade', book: 'Upgrade Cost' },
} as const satisfies Record<string, StatLabel>

type StatKey = keyof typeof STAT_LABELS

/**
 * The condition of a Mech Chassis, System or Module (Workshop Manual
 * pp.244-245): Intact, Damaged or Destroyed, keyed as the data stores it.
 */
export const CONDITION_LABELS = {
  intact: 'Intact',
  damaged: 'Damaged',
  destroyed: 'Destroyed',
} as const

export type ItemCondition = keyof typeof CONDITION_LABELS

/**
 * Each action type as the Core Book prints it on an action's line, keyed as
 * the data stores it: "Turn Action" (p.237), "Free Action", "Short Action",
 * "Long Action" and "Downtime Action", one word (p.238), but a bare
 * "Reaction" (p.238) and "Passive" (the legend, p.23).
 */
export const ACTION_TYPE_LABELS = {
  Turn: 'Turn Action',
  Free: 'Free Action',
  Short: 'Short Action',
  Long: 'Long Action',
  DownTime: 'Downtime Action',
  Reaction: 'Reaction',
  Passive: 'Passive',
} as const satisfies Record<string, string>

type StatConfig = {
  key: StatKey
  getter: (data: SURefMetaEntity) => number | undefined
  hint: string
  /** Kept by a primary-only cluster. */
  primary?: true
}

/**
 * Every stat, in the head's order. A hint the Core Book prints (Mech stats
 * p.96–97, Hit Points p.20) is a `bookQuote`; the rest are written here.
 */
const STATS: StatConfig[] = [
  {
    key: 'slotsRequired',
    getter: getSlotsRequired,
    hint: 'The number of slots required to install this System or Module on a Mech.',
  },
  {
    key: 'structurePoints',
    getter: getStructurePoints,
    hint: bookQuote(
      { source: 'Salvage Union Workshop Manual', page: 97 },
      'Structure Points represent how tough and sturdy your Mech is, and how much damage it can take. This is an abstract measure representing a broad range of factors ranging from sheer bulk and armour to wider defensive capabilities.'
    ),
    primary: true,
  },
  {
    key: 'hitPoints',
    getter: getHitPoints,
    hint: bookQuote(
      { source: 'Salvage Union Workshop Manual', page: 20 },
      'Hit Points are an abstract measure of how resilient your Pilot and NPCs are. This can represent a wide variety of different factors, including their ability to mitigate harm and defend themselves, their general toughness, as well as good fortune.'
    ),
  },
  {
    key: 'energyPoints',
    getter: getEnergyPoints,
    hint: bookQuote(
      { source: 'Salvage Union Workshop Manual', page: 96 },
      'Energy Points abstractly represents the energy output and efficiency of your Mechs reactor as well as its stored power. You can spend these points to activate your Systems, Modules, and Chassis Abilities.'
    ),
    primary: true,
  },
  {
    key: 'salvageValue',
    getter: getSalvageValue,
    hint: bookQuote(
      { source: 'Salvage Union Workshop Manual', page: 97 },
      "Salvage Value represents the sum of a Mech, System, or Module's material components. As such it's the amount of Scrap you receive when breaking down a Chassis, System, or Module, as well as the amount of Scrap required to craft a Mech, System, or Module."
    ),
    primary: true,
  },
  {
    key: 'bioSalvageValue',
    getter: getBioSalvageValue,
    hint: 'Bio-Salvage Value represents the biological material that can be harvested from this creature or NPC.',
    primary: true,
  },
  {
    key: 'systemSlots',
    getter: getSystemSlots,
    hint: bookQuote(
      { source: 'Salvage Union Workshop Manual', page: 97 },
      'Each System has a System Slot value which represents how much space it takes up on a Mech, conversely a Mechs System Slot value represents how many Systems it can mount. This is an abstract value that covers not only size, but energy requirements, ammo storage and a host of other factors.'
    ),
  },
  {
    key: 'moduleSlots',
    getter: getModuleSlots,
    hint: bookQuote(
      { source: 'Salvage Union Workshop Manual', page: 97 },
      "Each Module has a Module Slot value which represents how much space it takes up on a Mech, conversely a Mech's Module Slot value represents how many Modules it can mount."
    ),
  },
  {
    key: 'cargoCapacity',
    getter: getCargoCapacity,
    hint: bookQuote(
      { source: 'Salvage Union Workshop Manual', page: 97 },
      "A Mech's Cargo Slots represents how much it can carry. By default a Mech has 6 Cargo Slots. Cargo Capacity can be increased by installing Systems such as Transport Holds or Cargo Bays into your Mech, as well as from some unique Chassis and Pilot Abilities."
    ),
  },
  {
    key: 'heatCapacity',
    getter: getHeatCapacity,
    hint: bookQuote(
      { source: 'Salvage Union Workshop Manual', page: 97 },
      'Your Mech generates Heat when you activate some Systems and Modules or when you Push your reactor, its Heat Capacity represents its ability to operate under these conditions. If you reach your Heat Capacity your reactor will be at risk of overloading, with potentially catastrophic results.'
    ),
    primary: true,
  },
  // A Union Crawler's economy (Workshop Manual p.218): only
  // `crawler-tech-levels` carries these.
  {
    key: 'upkeepCost',
    getter: getUpkeepCost,
    hint: "Upkeep Cost is the Scrap of the Union Crawler's own Tech Level you must pay each Downtime to keep it running. Pay it in full and the same amount goes into your Upgrade Pool; fail to pay and the Crawler deteriorates.",
  },
  {
    key: 'upgradeCost',
    getter: getUpgradeCost,
    hint: 'Upgrade Cost is the Upgrade Pool total that unlocks the next Tech Level. The pool fills from the Upkeep you pay (and any extra Scrap you add during Downtime); the upgrade itself then takes one week. The maximum tech level has no upgrade cost, so it shows none.',
  },
]

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
    const names = STAT_LABELS[config.key]
    const bioNames = STAT_LABELS.bioSalvageValue
    return [
      {
        key: `ref-stat-${index}`,
        label: bio ? bioNames.book.toUpperCase() : names.label,
        short: bio ? bioNames.short : names.short,
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
    const names = STAT_LABELS[config.key]
    const label =
      getter === getSalvageValue && techLevel === 'B'
        ? STAT_LABELS.bioSalvageValue.book
        : names.book
    out.push({
      key: `book-${names.book}`,
      label,
      short: names.short,
      value,
      hint: config.hint,
    })
  })
  return out
}
