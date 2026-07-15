import type { CSSProperties } from 'react'
import type {
  SURefMetaEntity,
  SURefEnumSchemaName,
  SURefObjectBonusPerTechLevel,
  SURefEnumSource,
} from 'salvageunion-reference'
import {
  getBlackMarket,
  isHybridClass,
  isEntityData,
  getHybridClasses,
} from 'salvageunion-reference'

/**
 * The card's accent surface: a Tailwind bg class (or the white fallback) plus an
 * optional inline backgroundColor for dynamic per-source accents. Shared by the
 * body wrapper, the interactive footer wrapper, and ReferenceEntityFooter so the
 * `headerBg || 'bg-paper'` + `headerBgColor` fallback lives in one place.
 */
export function accentSurface(
  headerBg: string | undefined,
  headerBgColor: string | undefined
): { className: string; style: CSSProperties | undefined } {
  return {
    className: headerBg || 'bg-paper',
    style: headerBgColor ? { backgroundColor: headerBgColor } : undefined,
  }
}

/** Set of tree names that belong to hybrid classes (e.g. "Fabricator", "Cyborg") */
let _hybridTreeNames: Set<string> | null = null
function getHybridTreeNames(): Set<string> {
  if (!_hybridTreeNames) {
    _hybridTreeNames = new Set<string>()
    for (const cls of getHybridClasses()) {
      if ('advancedTree' in cls && cls.advancedTree) {
        _hybridTreeNames.add(String(cls.advancedTree))
      }
    }
  }
  return _hybridTreeNames
}

type SURefMetaSchemaName = SURefEnumSchemaName | 'actions'

/**
 * Calculate Tailwind bg class for entity display based on schema, tech level, and entity data
 * Returns Tailwind class names instead of Chakra tokens
 */
export function calculateBackgroundColor(
  schemaName: SURefMetaSchemaName,
  headerColor: string = '',
  techLevel: number | undefined,
  data: SURefMetaEntity | SURefObjectBonusPerTechLevel,
  techLevelColors: Record<number, string>
): string {
  if (isEntityData(data) && getBlackMarket(data) === true) {
    return 'bg-su-grey-dark'
  }

  if (schemaName === 'chassis') return 'bg-su-green'
  if (schemaName === 'crawlers') return headerColor || 'bg-su-pink'
  if (schemaName === 'crawler-tech-levels') return headerColor || 'bg-su-pink'
  if (schemaName === 'crawler-bays') return headerColor || 'bg-su-pink'
  if (schemaName === 'creatures') return headerColor || 'bg-su-rust'
  if (schemaName === 'bio-titans') return headerColor || 'bg-su-rust'
  if (schemaName === 'factions') return headerColor || 'bg-su-rust'
  if (schemaName === 'npcs') return headerColor || 'bg-su-rust'
  if (schemaName === 'meld') return headerColor || 'bg-su-rust'
  if (schemaName === 'squads') return headerColor || 'bg-su-rust'
  if (schemaName === 'keywords') return headerColor || 'bg-su-grey-dark'
  if (schemaName === 'distances') return headerColor || 'bg-su-grey-dark'
  if (schemaName === 'traits') return headerColor || 'bg-su-grey-dark'
  if (schemaName === 'guides') return headerColor || 'bg-su-grey-dark'
  if (schemaName === 'roll-tables') return headerColor || 'bg-su-grey-dark'
  if (schemaName === 'sources') return headerColor || 'bg-su-grey-dark'
  if (schemaName === 'classes' && !headerColor) {
    if (isEntityData(data)) {
      const isHybrid = isHybridClass(data)
      return isHybrid ? 'bg-su-pink' : 'bg-su-orange'
    }
    return 'bg-su-orange'
  }
  if (schemaName === 'classes') return headerColor || 'bg-su-orange'

  if (schemaName === 'abilities' && !headerColor) {
    const isLegendary =
      ('level' in data && String(data.level).toUpperCase() === 'L') ||
      ('tree' in data && String(data.tree).includes('Legendary'))
    const treeName = 'tree' in data ? String(data.tree) : ''
    const isAdvancedOrHybrid = treeName.includes('Advanced') || getHybridTreeNames().has(treeName)

    if (isLegendary) {
      return 'bg-su-pink'
    } else if (isAdvancedOrHybrid) {
      return 'bg-su-orange-dark'
    } else {
      return 'bg-su-orange'
    }
  }

  if (schemaName === 'ability-tree-requirements' && !headerColor) {
    const name = 'name' in data ? String(data.name).toLowerCase() : ''
    if (name.includes('legendary')) {
      return 'bg-su-pink'
    } else if (name.includes('advanced') || name.includes('hybrid')) {
      return 'bg-su-brick'
    }
    return 'bg-su-orange'
  }

  if (headerColor) return headerColor
  if (techLevel) return techLevelColors[techLevel] ?? 'bg-su-orange'
  return 'bg-su-orange'
}

/**
 * Derive a CSS color value from a Tailwind bg class (e.g. 'bg-su-orange' → 'var(--color-su-orange)').
 * Returns undefined when headerBg is falsy so callers can skip border styling.
 */
export function borderColorFromHeaderBg(
  headerBg: string | undefined,
  headerBgColor?: string
): string | undefined {
  if (headerBgColor) return headerBgColor
  return headerBg ? `var(--color-${headerBg.replace('bg-', '')})` : undefined
}

/**
 * Lighter tint of the card's accent (header) colour — a pale variant of the base
 * layer, used for the flavour/"accent" text that sits on the coloured field.
 * Derived via color-mix so it works for every accent (tokens are inconsistent —
 * su-rust/su-pink have no -light variant). Undefined when there is no accent.
 */
export function accentTextColor(
  headerBg: string | undefined,
  headerBgColor?: string
): string | undefined {
  const base = borderColorFromHeaderBg(headerBg, headerBgColor)
  return base ? `color-mix(in srgb, ${base} 30%, white)` : undefined
}

/**
 * Deeper (darker) tint of the card's accent (header) colour — the "deep" variant,
 * used for the white body box's 3px left accent border.
 */
export function accentDeepColor(
  headerBg: string | undefined,
  headerBgColor?: string
): string | undefined {
  const base = borderColorFromHeaderBg(headerBg, headerBgColor)
  return base ? `color-mix(in srgb, ${base} 65%, black)` : undefined
}

/**
 * Get a themed border color for expansion-sourced entities.
 * Returns undefined for core-book sources so the caller can fall back to defaults.
 */
export function getSourceBorderColor(source: SURefEnumSource | undefined): string | undefined {
  switch (source) {
    case 'We Were Here First!':
      return 'rgb(55, 48, 35)'
    case 'False Flag':
      return 'rgb(128, 128, 128)'
    case 'Rainmaker':
      return 'rgb(55, 70, 85)'
    case 'Mech Monday':
      return 'rgb(25, 55, 30)'
    case 'Salvage Union Starter Set':
      return 'rgb(25, 55, 30)'
    case 'Reclamation of the Wastes':
      return 'rgb(110, 80, 45)'
    case 'The Hive':
      return 'rgb(140, 95, 25)'
    case "Thatcher's Mech Base":
      return 'rgb(50, 55, 65)'
    case 'Relics of a Time Gone By':
      return 'rgb(85, 70, 50)'
    default:
      return undefined
  }
}
