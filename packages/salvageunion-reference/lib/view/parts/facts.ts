/**
 * An entity's STATS as facts: the head's cells and the page's stat column.
 * the UI library's `referenceEntityStatsConfig.ts` builds its `StatItem`s from
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
import type { RefEnumSchemaName, RefMetaEntity } from '../../schemas/index'
import type { Fact, StatGroup } from '../types'

/** A stat's names, as every surface prints it: one vocabulary, read everywhere. */
export type StatLabel = {
  /** The full name, two words: a full-size value box sets one per line. */
  label: string
  /** The game's own abbreviation, or the first word where that already is one. */
  short: string
}

/**
 * Every stat's names, keyed as the data names the stat (a contribution's
 * `stat`, a getter's field). The sheet rails, the Discord bot and a pattern's
 * stat plates read these rather than spelling their own.
 */
export const STAT_LABELS = {
  slotsRequired: { label: 'Slots Required', short: 'Slots' },
  structurePoints: { label: 'Structure Points', short: 'SP' },
  hitPoints: { label: 'Hit Points', short: 'HP' },
  energyPoints: { label: 'Energy Points', short: 'EP' },
  salvageValue: { label: 'Salvage Value', short: 'SV' },
  // "Bio-Salvage", hyphenated, as the Workshop Manual prints it (p.275).
  bioSalvageValue: { label: 'Bio-Salvage Value', short: 'Bio' },
  systemSlots: { label: 'System Slots', short: 'SYS' },
  moduleSlots: { label: 'Module Slots', short: 'MODS' },
  cargoCapacity: { label: 'Cargo Capacity', short: 'Cargo' },
  heatCapacity: { label: 'Heat Capacity', short: 'Heat' },
  upkeepCost: { label: 'Upkeep Cost', short: 'Upkeep' },
  upgradeCost: { label: 'Upgrade Cost', short: 'Upgrade' },
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
  getter: (data: RefMetaEntity) => number | undefined
  group: StatGroup
  hint: string
}

/**
 * Every stat, in THE order: one order for every form and
 * surface, a smaller form dropping stats but never moving them. Tech Level
 * leads it (`techLevelFact`, added by the caller), then four groups:
 * provenance (Tech Level, Slots Required, Salvage Value: the book's gear
 * sidebar, Workshop Manual pp.163, 191), vitals (SP or HP, EP; Bio-Salvage
 * after the HP it comes from), capacity (System and Module Slots, then Heat
 * beside Cargo, the two capacities; a crawler's
 * Upkeep and Upgrade), then an
 * action's facets (`facetCells`). A hint the Core Book prints (Mech stats
 * p.96–97, Hit Points p.20) is a `bookQuote`; the rest are written here.
 */
const STATS: StatConfig[] = [
  {
    key: 'slotsRequired',
    getter: getSlotsRequired,
    group: 'provenance',
    hint: 'The number of slots required to install this System or Module on a Mech.',
  },
  {
    key: 'salvageValue',
    getter: getSalvageValue,
    group: 'provenance',
    hint: bookQuote(
      { source: 'Salvage Union Workshop Manual', page: 97 },
      "Salvage Value represents the sum of a Mech, System, or Module's material components. As such it's the amount of Scrap you receive when breaking down a Chassis, System, or Module, as well as the amount of Scrap required to craft a Mech, System, or Module."
    ),
  },
  {
    key: 'structurePoints',
    getter: getStructurePoints,
    group: 'vitals',
    hint: bookQuote(
      { source: 'Salvage Union Workshop Manual', page: 97 },
      'Structure Points represent how tough and sturdy your Mech is, and how much damage it can take. This is an abstract measure representing a broad range of factors ranging from sheer bulk and armour to wider defensive capabilities.'
    ),
  },
  {
    key: 'hitPoints',
    getter: getHitPoints,
    group: 'vitals',
    hint: bookQuote(
      { source: 'Salvage Union Workshop Manual', page: 20 },
      'Hit Points are an abstract measure of how resilient your Pilot and NPCs are. This can represent a wide variety of different factors, including their ability to mitigate harm and defend themselves, their general toughness, as well as good fortune.'
    ),
  },
  {
    key: 'energyPoints',
    getter: getEnergyPoints,
    group: 'vitals',
    hint: bookQuote(
      { source: 'Salvage Union Workshop Manual', page: 96 },
      'Energy Points abstractly represents the energy output and efficiency of your Mechs reactor as well as its stored power. You can spend these points to activate your Systems, Modules, and Chassis Abilities.'
    ),
  },
  {
    key: 'bioSalvageValue',
    getter: getBioSalvageValue,
    group: 'vitals',
    hint: 'Bio-Salvage Value represents the biological material that can be harvested from this creature or NPC.',
  },
  {
    key: 'systemSlots',
    getter: getSystemSlots,
    group: 'capacity',
    hint: bookQuote(
      { source: 'Salvage Union Workshop Manual', page: 97 },
      'Each System has a System Slot value which represents how much space it takes up on a Mech, conversely a Mechs System Slot value represents how many Systems it can mount. This is an abstract value that covers not only size, but energy requirements, ammo storage and a host of other factors.'
    ),
  },
  {
    key: 'moduleSlots',
    getter: getModuleSlots,
    group: 'capacity',
    hint: bookQuote(
      { source: 'Salvage Union Workshop Manual', page: 97 },
      "Each Module has a Module Slot value which represents how much space it takes up on a Mech, conversely a Mech's Module Slot value represents how many Modules it can mount."
    ),
  },
  {
    key: 'heatCapacity',
    getter: getHeatCapacity,
    group: 'capacity',
    hint: bookQuote(
      { source: 'Salvage Union Workshop Manual', page: 97 },
      'Your Mech generates Heat when you activate some Systems and Modules or when you Push your reactor, its Heat Capacity represents its ability to operate under these conditions. If you reach your Heat Capacity your reactor will be at risk of overloading, with potentially catastrophic results.'
    ),
  },
  {
    key: 'cargoCapacity',
    getter: getCargoCapacity,
    group: 'capacity',
    hint: bookQuote(
      { source: 'Salvage Union Workshop Manual', page: 97 },
      "A Mech's Cargo Slots represents how much it can carry. By default a Mech has 6 Cargo Slots. Cargo Capacity can be increased by installing Systems such as Transport Holds or Cargo Bays into your Mech, as well as from some unique Chassis and Pilot Abilities."
    ),
  },
  // A Union Crawler's economy (Workshop Manual p.218): only
  // `crawler-tech-levels` carries these.
  {
    key: 'upkeepCost',
    getter: getUpkeepCost,
    group: 'capacity',
    hint: "Upkeep Cost is the Scrap of the Union Crawler's own Tech Level you must pay each Downtime to keep it running. Pay it in full and the same amount goes into your Upgrade Pool; fail to pay and the Crawler deteriorates.",
  },
  {
    key: 'upgradeCost',
    getter: getUpgradeCost,
    group: 'capacity',
    hint: 'Upgrade Cost is the Upgrade Pool total that unlocks the next Tech Level. The pool fills from the Upkeep you pay (and any extra Scrap you add during Downtime); the upgrade itself then takes one week. The maximum tech level has no upgrade cost, so it shows none.',
  },
]

/** A stat's value, or `undefined` when absent or zero (zeros are not printed). */
function statValue(
  config: StatConfig,
  entity: RefMetaEntity,
  schemaName: RefEnumSchemaName | 'actions' | undefined
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
 * A chassis's chips in a Compact, CompactIndex or Mini: TL,
 * SV, SP, EP, SYS, MODS. Its Page and its Peek print every stat, Cargo and
 * Heat too.
 */
const CHASSIS_CHIPS: ReadonlySet<StatKey> = new Set([
  'salvageValue',
  'structurePoints',
  'energyPoints',
  'systemSlots',
  'moduleSlots',
])

type StatOptions = {
  schemaName?: RefEnumSchemaName | 'actions'
  techLevel?: number | 'B' | 'N'
  /** Every stat, a chassis's included: the Peek's. */
  every?: boolean
}

/** Every stat the entity has, in THE order (`STATS`), with the names it prints. */
function orderedStats(
  entity: RefMetaEntity,
  options: StatOptions
): { config: StatConfig; value: string; names: StatLabel }[] {
  const isBio = options.techLevel === 'B'
  return STATS.flatMap((config) => {
    const value = statValue(config, entity, options.schemaName)
    if (value === undefined) return []
    // On a Bio tech-level entity the salvage value is its BIO-SALVAGE value.
    const names =
      isBio && config.key === 'salvageValue' ? STAT_LABELS.bioSalvageValue : STAT_LABELS[config.key]
    return [{ config, value, names }]
  })
}

/**
 * The entity's stats as every form but a Page prints them, in THE order
 * (`STATS`), the Tech Level not among them (`techLevelFact` leads them). A
 * chassis keeps its chip set (`CHASSIS_CHIPS`) but in a Peek (`every`).
 */
export function entityStats(entity: RefMetaEntity, options: StatOptions): Fact[] {
  const chassis = options.schemaName === 'chassis' && !options.every
  return orderedStats(entity, options)
    .filter(({ config }) => !chassis || CHASSIS_CHIPS.has(config.key))
    .map(({ config, value, names }) => ({
      key: `ref-stat-${config.key}`,
      label: names.label,
      short: names.short,
      value,
      group: config.group,
      hint: config.hint,
    }))
}

/** The Tech Level as a fact, keyed as the head's TL cell: first of every stat line. */
export function techLevelFact(techLevel: number | 'B' | 'N'): Fact {
  return {
    key: 'tech-level',
    label: 'Tech Level',
    short: 'TL',
    value: String(techLevel),
    group: 'provenance',
  }
}

/**
 * The page's stat column: the Tech Level, then every stat, in THE order
 * (`STATS`), under its full name ("Structure Points", never the book's
 * "Structure Pts."): a Page's band and a chassis's body stats print the long
 * label, every smaller form the short one, in the same order.
 */
export function bookStats(entity: RefMetaEntity, options: StatOptions): Fact[] {
  const { techLevel } = options
  return [
    ...(techLevel != null ? [techLevelFact(techLevel)] : []),
    ...orderedStats(entity, options).map(({ config, value, names }) => ({
      key: `book-${STAT_LABELS[config.key].label}`,
      label: names.label,
      short: STAT_LABELS[config.key].short,
      value,
      group: config.group,
      hint: config.hint,
    })),
  ]
}

type Grouped = { group?: StatGroup }

/**
 * A stat line split where its action starts: the stats (provenance, vitals,
 * capacity) lead, then the action type (drawn by the caller), then the
 * action's facets (RNG, DMG). A cell with no group stays where it is.
 */
export function splitStatLine<T extends Grouped>(cells: readonly T[]): { stats: T[]; action: T[] } {
  let at = 0
  cells.forEach((cell, index) => {
    if (cell.group && cell.group !== 'action') at = index + 1
  })
  return { stats: cells.slice(0, at), action: cells.slice(at) }
}

/** Whether a cell opens a new group (a stat column's new row): its group differs from the last one's. */
export function opensGroup<T extends Grouped>(cells: readonly T[], index: number): boolean {
  const cell = cells[index]
  const previous = index > 0 ? cells[index - 1] : undefined
  return !!cell?.group && !!previous?.group && cell.group !== previous.group
}
