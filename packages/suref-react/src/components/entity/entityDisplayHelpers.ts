import type {
  SURefMetaEntity,
  SURefEnumSchemaName,
  SURefObjectBonusPerTechLevel,
  SURefObjectSystemModule,
  SURefEnumSource,
} from 'salvageunion-reference'
import {
  getBlackMarket,
  isHybridClass,
  isSystemModule,
  getEntityNameFromSystemModule,
  extractVisibleActions,
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

export function extractName(
  data: SURefMetaEntity | SURefObjectBonusPerTechLevel,
  schemaName: SURefEnumSchemaName
): string {
  if (!('name' in data)) {
    return ''
  }

  if (schemaName === 'ability-tree-requirements') {
    return data.name + ' Tree Requirements'
  }
  return data.name ?? ''
}

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
  if (schemaName === 'keywords') return headerColor || 'bg-su-grey-light'
  if (schemaName === 'distances') return headerColor || 'bg-su-grey-light'
  if (schemaName === 'traits') return headerColor || 'bg-su-grey-light'
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

export function calculateOpacity(dimHeader: boolean, disabled: boolean) {
  return {
    header: dimHeader ? 0.5 : 1,
    content: disabled ? 0.5 : 1,
  }
}

export function createHeaderClickHandler(
  onClick: (() => void) | undefined,
  disabled: boolean
): (() => void) | undefined {
  if (!onClick) {
    return undefined
  }

  return () => {
    if (!disabled) {
      onClick()
    }
  }
}

export function shouldShowExtraContent(compact: boolean, hideActions: boolean): boolean {
  return compact ? !hideActions : true
}

export function getEntityDisplayName(data: SURefMetaEntity, title?: string): string {
  return title || ('name' in data ? String(data.name) : '')
}

export function resolveEntityName(
  entity: SURefMetaEntity | SURefObjectSystemModule,
  title?: string
): string | undefined {
  if (title) {
    return title
  }

  if ('name' in entity && typeof entity.name === 'string') {
    return entity.name
  }

  if ('value' in entity && typeof entity.value === 'string') {
    return entity.value
  }

  if (isSystemModule(entity as SURefMetaEntity)) {
    return getEntityNameFromSystemModule(entity as SURefObjectSystemModule)
  }

  const visibleActions = extractVisibleActions(entity as SURefMetaEntity)
  if (visibleActions && visibleActions.length > 0) {
    return visibleActions[0]?.name
  }

  return undefined
}

/**
 * Derive a CSS color value from a Tailwind bg class (e.g. 'bg-su-orange' → 'var(--color-su-orange)').
 * Returns undefined when headerBg is falsy so callers can skip border styling.
 */
export function borderColorFromHeaderBg(headerBg: string | undefined): string | undefined {
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
          borderTop: '2px solid rgba(255, 255, 255, 0.5)',
          borderLeft: '2px solid rgba(255, 255, 255, 0.5)',
          borderBottom: '2px solid rgba(0, 0, 0, 0.3)',
          borderRight: '2px solid rgba(0, 0, 0, 0.3)',
          boxShadow:
            'inset 1px 1px 0 0 rgba(255, 255, 255, 0.3), inset -1px -1px 0 0 rgba(0, 0, 0, 0.2)',
        },
      }
    }
    case 'Rainmaker': {
      return {
        className: variant === 'header' ? 'expansion-rain-down' : 'expansion-rain-into-footer',
        style: {},
      }
    }
    default:
      return { className: '', style: {} }
  }
}
