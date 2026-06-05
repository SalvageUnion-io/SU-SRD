import type {
  SURefMetaEntity,
  SURefObjectBonusPerTechLevel,
  SURefEnumSchemaName,
} from 'salvageunion-reference'
import {
  getSlotsRequired,
  getSalvageValue,
  getBioSalvageValue,
  getStructurePoints,
  getEnergyPoints,
  getHeatCapacity,
  getSystemSlots,
  getModuleSlots,
  getCargoCapacity,
  getHitPoints,
} from 'salvageunion-reference'
import type { StatItem } from '../../shared/statsBarTypes'

export type StatConfig = {
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
  /** When true, this stat is shown even when primaryOnly filtering is active */
  primary?: boolean
}

/**
 * Configuration for all entity stats displayed in ReferenceEntityStats component.
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
    primary: true,
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
    primary: true,
  },
  {
    getter: getSalvageValue,
    compactLabel: 'SV',
    normalLabel: 'Salvage',
    compactBottomLabel: '',
    normalBottomLabel: 'Value',
    tooltip:
      "Salvage Value represents the sum of a Mech, System, or Module's material components. As such it's the amount of Scrap you receive when breaking down a Chassis, System, or Module, as well as the amount of Scrap required to craft a Mech, System, or Module.",
    primary: true,
  },
  {
    getter: getBioSalvageValue,
    compactLabel: 'Bio',
    normalLabel: 'Bio',
    compactBottomLabel: 'SV',
    normalBottomLabel: 'SV',
    tooltip:
      'Bio Salvage Value represents the biological material that can be harvested from this creature or NPC.',
    primary: true,
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
    primary: true,
  },
]

/**
 * Apply label formatting (prefix, zero handling)
 */
function applyStatLabel(
  value: number | string | undefined,
  prefix: string = ''
): string | undefined {
  if (value === undefined || value === 0) return undefined
  return `${prefix}${value}`
}

export type SvOverride = {
  value: number | string
  bottomLabel: string
}

type BuildReferenceEntityStatsOptions = {
  compact: boolean
  listing?: boolean
  primaryOnly?: boolean
  svOverride?: SvOverride
  techLevel?: number | 'B' | 'N'
  prefix?: string
  /** Schema name of the entity — used to scope schema-specific stat derivations. */
  schemaName?: SURefEnumSchemaName
}

/**
 * Builds a StatItem[] from reference entity data using ENTITY_STATS_CONFIG.
 * Returns items only for stats that have defined values.
 */
export function buildReferenceEntityStats(
  data: SURefMetaEntity | SURefObjectBonusPerTechLevel,
  options: BuildReferenceEntityStatsOptions
): StatItem[] {
  const {
    compact,
    listing = false,
    primaryOnly = false,
    svOverride,
    techLevel,
    prefix = '',
    schemaName,
  } = options
  const entityData = data as SURefMetaEntity
  const isBioTechLevel = techLevel === 'B'
  const salvageValue = getSalvageValue(entityData)
  const hasBioSalvage = isBioTechLevel && salvageValue !== undefined
  const suppressTooltips = compact && listing

  const items: StatItem[] = []

  for (let i = 0; i < ENTITY_STATS_CONFIG.length; i++) {
    const config = ENTITY_STATS_CONFIG[i]!
    if (primaryOnly && !config.primary) continue
    const isSalvageValue = config.getter === getSalvageValue

    if (isSalvageValue && svOverride) {
      const overrideDisplay = svOverride.value === 0 ? undefined : `${prefix}${svOverride.value}`
      items.push({
        key: `ref-stat-${i}`,
        label: compact ? config.compactLabel : config.normalLabel,
        bottomLabel: svOverride.bottomLabel,
        value: overrideDisplay,
        hoverText: suppressTooltips ? undefined : config.tooltip,
      })
      continue
    }

    let value = config.getter(entityData)
    // Bio-Titans surface bio-salvage equal to their Structure Points (core-book
    // rule). There is no stored bioSalvageValue field — derive it from SP here,
    // scoped strictly to bio-titans so no other entity gains a derived stat.
    if (
      value === undefined &&
      config.getter === getBioSalvageValue &&
      schemaName === 'bio-titans'
    ) {
      value = getStructurePoints(entityData)
    }
    const displayValue = applyStatLabel(value, prefix)
    if (displayValue === undefined) continue

    if (isSalvageValue && hasBioSalvage) {
      items.push({
        key: `ref-stat-${i}`,
        label: compact ? 'BSV' : 'BIO-SALVAGE',
        bottomLabel: compact ? '' : 'VALUE',
        value: displayValue,
        hoverText: suppressTooltips ? undefined : config.tooltip,
        bg: 'bg-su-sickly-yellow',
        valueColor: 'text-su-black',
        inverse: false,
      })
      continue
    }

    items.push({
      key: `ref-stat-${i}`,
      label: compact ? config.compactLabel : config.normalLabel,
      bottomLabel: compact ? config.compactBottomLabel : config.normalBottomLabel,
      value: displayValue,
      hoverText: suppressTooltips ? undefined : config.tooltip,
    })
  }

  return items
}
