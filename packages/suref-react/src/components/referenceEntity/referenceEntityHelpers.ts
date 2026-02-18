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
  if (schemaName === 'keywords') return headerColor || 'bg-su-black'
  if (schemaName === 'distances') return headerColor || 'bg-su-black'
  if (schemaName === 'traits') return headerColor || 'bg-su-black'
  if (schemaName === 'guides') return headerColor || 'bg-su-black'
  if (schemaName === 'roll-tables') return headerColor || 'bg-su-black'
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
 * Get source-specific styles for entity display.
 * Returns { className, style } for use with Tailwind + inline styles.
 *
 * Effects by expansion:
 * - We Were Here First!: Beast-like fangs (CSS pseudo-elements via theme.css)
 * - Rainmaker: Falling raindrops (CSS pseudo-elements via theme.css)
 * - False Flag: Windows 95-esque beveled border (inline styles)
 * - Mech Monday: Digital scanlines (CSS pseudo-elements via theme.css)
 */
export function getSourceStyles(
  source: SURefEnumSource | undefined,
  disabled: boolean = false,
  variant: 'header' | 'footer' = 'header',
  isExpanded: boolean = true
): { className: string; style: React.CSSProperties } {
  if (!source || disabled) return { className: '', style: {} }
  if (!isExpanded && variant === 'footer') return { className: '', style: {} }

  switch (source) {
    case 'We Were Here First!': {
      return {
        className: variant === 'header' ? 'expansion-fangs-down' : 'expansion-fangs-up',
        style: {},
      }
    }
    case 'False Flag': {
      return {
        className: 'relative',
        style: {
          borderTop: '3px solid #dfdfdf',
          borderLeft: '3px solid #dfdfdf',
          borderBottom: '3px solid #404040',
          borderRight: '3px solid #404040',
          boxShadow: 'inset 2px 2px 0 0 #fff, inset -2px -2px 0 0 #808080, 1px 1px 0 0 #000',
        },
      }
    }
    case 'Rainmaker': {
      return {
        className: variant === 'header' ? 'expansion-rain-down' : 'expansion-rain-into-footer',
        style: {},
      }
    }
    case 'Mech Monday': {
      return {
        className: variant === 'header' ? 'expansion-scanlines-down' : 'expansion-scanlines-up',
        style: {},
      }
    }
    default:
      return { className: '', style: {} }
  }
}
