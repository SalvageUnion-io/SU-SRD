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
} from 'salvageunion-reference'

/**
 * Local type that extends SURefEnumSchemaName to include meta schemas like 'actions'
 */
type SURefMetaSchemaName = SURefEnumSchemaName | 'actions'

/**
 * Get activation currency based on schema name
 */
export function getActivationCurrency(
  schemaName: SURefMetaSchemaName | undefined,
  variable: boolean = false
): 'AP' | 'EP' | 'XP' {
  if (variable) return 'XP'
  if (schemaName === 'systems' || schemaName === 'modules') {
    return 'EP'
  }
  return 'AP'
}

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
 * Calculate background color for entity display based on schema, tech level, and entity data
 */
export function calculateBackgroundColor(
  schemaName: SURefMetaSchemaName,
  headerColor: string = '',
  techLevel: number | undefined,
  data: SURefMetaEntity | SURefObjectBonusPerTechLevel,
  techLevelColors: Record<number, string>
): string {
  // Check for Black Market items first - they get dark grey background
  if (
    'id' in data &&
    'name' in data &&
    'source' in data &&
    'page' in data &&
    getBlackMarket(data) === true
  ) {
    return 'su.darkGrey'
  }

  if (schemaName === 'chassis') return 'su.green'
  if (schemaName === 'crawlers') return headerColor || 'su.pink'
  if (schemaName === 'crawler-tech-levels') return headerColor || 'su.pink'
  if (schemaName === 'crawler-bays') return headerColor || 'su.pink'
  if (schemaName === 'creatures') return headerColor || 'su.orange'
  if (schemaName === 'bio-titans') return headerColor || 'su.orange'
  if (schemaName === 'keywords') return headerColor || 'su.orange'
  if (schemaName === 'traits') return headerColor || 'su.orange'
  if (schemaName === 'roll-tables') return headerColor || 'su.orange'
  if (schemaName === 'classes' && !headerColor) {
    // Base class (hybrid is false or missing) -> pilot orange
    // Hybrid class -> legendary color (pink)
    // Check if data is a valid entity (not SURefObjectBonusPerTechLevel)
    if ('id' in data && 'name' in data && 'source' in data && 'page' in data) {
      const isHybrid = isHybridClass(data as SURefMetaEntity)
      return isHybrid ? 'su.pink' : 'su.orange'
    }
    return 'su.orange'
  }
  if (schemaName === 'classes') return headerColor || 'su.orange'

  if (schemaName === 'abilities' && !headerColor) {
    const isLegendary =
      ('level' in data && String(data.level).toUpperCase() === 'L') ||
      ('tree' in data && String(data.tree).includes('Legendary'))
    const isAdvancedOrHybrid =
      'tree' in data &&
      (String(data.tree).includes('Advanced') || String(data.tree).includes('Hybrid'))

    if (isLegendary) {
      return 'su.pink'
    } else if (isAdvancedOrHybrid) {
      return 'su.darkOrange'
    } else {
      return 'su.orange'
    }
  }

  if (schemaName === 'ability-tree-requirements' && !headerColor) {
    const name = 'name' in data ? String(data.name).toLowerCase() : ''
    if (name.includes('legendary')) {
      return 'su.pink'
    } else if (name.includes('advanced') || name.includes('hybrid')) {
      return 'brand.srd'
    }
    return 'su.orange'
  }

  if (headerColor) return headerColor
  if (techLevel) return techLevelColors[techLevel] ?? 'su.orange'
  return 'su.orange'
}

/**
 * Calculate opacity values for entity display
 */
export function calculateOpacity(dimHeader: boolean, disabled: boolean) {
  return {
    header: dimHeader ? 0.5 : 1,
    content: disabled ? 0.5 : 1,
  }
}

/**
 * Determine which action to take when header is clicked
 * Priority order:
 * 1. If there's a button config and it's collapsible, toggle
 * 2. If there's an onClick handler and not disabled, call it
 * 3. If collapsible, toggle
 */
export function createHeaderClickHandler(
  hasButtonConfig: boolean,
  collapsible: boolean,
  onClick: (() => void) | undefined,
  disabled: boolean,
  onToggle: () => void
): () => void {
  return () => {
    if (hasButtonConfig && collapsible) {
      onToggle()
      return
    }

    if (onClick && !disabled) {
      onClick()
      return
    }

    if (collapsible) {
      onToggle()
    }
  }
}

/**
 * Determine if extra content should be shown based on compact mode and hideActions flag
 * In compact mode, only show extra sections if actions are not hidden
 * In normal mode, always show extra sections
 */
export function shouldShowExtraContent(compact: boolean, hideActions: boolean): boolean {
  return compact ? !hideActions : true
}

/**
 * Get entity display name with fallback to title
 * Consolidates entity name extraction logic from multiple components
 * @param data - The entity data
 * @param title - Optional title to use as fallback
 * @returns The entity display name
 */
export function getEntityDisplayName(data: SURefMetaEntity, title?: string): string {
  return title || ('name' in data ? String(data.name) : '')
}

/**
 * Resolve entity name from various entity types
 * Handles regular entities, system modules, and custom system options
 * @param entity - The entity (can be SURefMetaEntity or SURefObjectSystemModule)
 * @param title - Optional title to use as fallback
 * @returns The resolved entity name or undefined
 */
export function resolveEntityName(
  entity: SURefMetaEntity | SURefObjectSystemModule,
  title?: string
): string | undefined {
  // If we have a title, use it
  if (title) {
    return title
  }

  // Check if entity has a name property
  if ('name' in entity && typeof entity.name === 'string') {
    return entity.name
  }

  // Check if entity has a value property (for custom system options)
  if ('value' in entity && typeof entity.value === 'string') {
    return entity.value
  }

  // Check if entity is a system module
  if (isSystemModule(entity as SURefMetaEntity)) {
    return getEntityNameFromSystemModule(entity as SURefObjectSystemModule)
  }

  // Try to get name from visible actions (fallback for entities without direct name)
  const visibleActions = extractVisibleActions(entity as SURefMetaEntity)
  if (visibleActions && visibleActions.length > 0) {
    return visibleActions[0]?.name
  }

  return undefined
}

/**
 * Get source-specific CSS styles for entity headers and footers
 * @param source - The source book name
 * @param disabled - Whether the entity is disabled
 * @param variant - Whether this is for 'header' (bottom jagged) or 'footer' (top jagged)
 * @param isExpanded - Whether the entity is expanded (styles only apply when expanded)
 * @returns CSS styles object or empty object
 */
export function getSourceStyles(
  source: SURefEnumSource | undefined,
  disabled: boolean = false,
  variant: 'header' | 'footer' = 'header',
  isExpanded: boolean = true
): Record<string, unknown> {
  if (!source || disabled || !isExpanded) return {}

  switch (source) {
    case 'We Were Here First!': {
      // Jagged clipPath using percentage-based values that scale with element size
      // Header: jagged bottom edge only
      // Footer: jagged top edge only
      // Add speckled su.brick background pattern styled after dirt
      const baseStyles = {
        position: 'relative' as const,
        // Speckled dirt texture overlay - always visible
        backgroundImage: `
          radial-gradient(circle at 10% 20%, rgba(168, 89, 71, 0.5) 1px, transparent 1px),
          radial-gradient(circle at 30% 45%, rgba(168, 89, 71, 0.45) 0.5px, transparent 0.5px),
          radial-gradient(circle at 50% 15%, rgba(168, 89, 71, 0.55) 1.5px, transparent 1.5px),
          radial-gradient(circle at 70% 60%, rgba(168, 89, 71, 0.4) 1px, transparent 1px),
          radial-gradient(circle at 85% 30%, rgba(168, 89, 71, 0.5) 0.8px, transparent 0.8px),
          radial-gradient(circle at 15% 70%, rgba(168, 89, 71, 0.45) 1.2px, transparent 1.2px),
          radial-gradient(circle at 40% 80%, rgba(168, 89, 71, 0.5) 1px, transparent 1px),
          radial-gradient(circle at 60% 50%, rgba(168, 89, 71, 0.4) 0.6px, transparent 0.6px),
          radial-gradient(circle at 90% 75%, rgba(168, 89, 71, 0.55) 1.3px, transparent 1.3px),
          radial-gradient(circle at 25% 55%, rgba(168, 89, 71, 0.45) 1px, transparent 1px),
          radial-gradient(circle at 55% 25%, rgba(168, 89, 71, 0.5) 0.9px, transparent 0.9px),
          radial-gradient(circle at 75% 10%, rgba(168, 89, 71, 0.4) 1.1px, transparent 1.1px),
          radial-gradient(circle at 5% 90%, rgba(168, 89, 71, 0.5) 1px, transparent 1px),
          radial-gradient(circle at 95% 40%, rgba(168, 89, 71, 0.45) 0.7px, transparent 0.7px),
          radial-gradient(circle at 20% 5%, rgba(168, 89, 71, 0.55) 1.4px, transparent 1.4px),
          radial-gradient(circle at 45% 65%, rgba(168, 89, 71, 0.4) 1px, transparent 1px),
          radial-gradient(circle at 65% 85%, rgba(168, 89, 71, 0.5) 0.8px, transparent 0.8px),
          radial-gradient(circle at 80% 20%, rgba(168, 89, 71, 0.45) 1.2px, transparent 1.2px),
          radial-gradient(circle at 35% 35%, rgba(168, 89, 71, 0.5) 1px, transparent 1px),
          radial-gradient(circle at 12% 95%, rgba(168, 89, 71, 0.4) 0.9px, transparent 0.9px)
        `,
        backgroundSize:
          '200px 200px, 150px 150px, 180px 180px, 160px 160px, 170px 170px, 190px 190px, 140px 140px, 165px 165px, 175px 175px, 155px 155px, 185px 185px, 145px 145px, 195px 195px, 135px 135px, 200px 200px, 148px 148px, 162px 162px, 178px 178px, 152px 152px, 188px 188px',
        backgroundPosition:
          '0 0, 20px 30px, 40px 10px, 60px 50px, 80px 20px, 10px 60px, 30px 70px, 50px 40px, 70px 65px, 15px 45px, 45px 15px, 65px 0px, 5px 80px, 85px 30px, 20px 5px, 35px 55px, 55px 75px, 75px 10px, 25px 25px, 12px 85px',
      }

      if (variant === 'header') {
        // Header: use ::after pseudo-element to extend jagged teeth below the header
        // Maximum dramatic spikes (0-100% range) with reduced height (5px)
        return {
          ...baseStyles,
          '&::after': {
            content: '""',
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: '100%',
            height: '7px',
            background: 'inherit',
            clipPath: `polygon(
              0% 0%,
              100% 0%,
              100% 100%,
              98.5% 100%, 98% 22%, 97.5% 78%, 97% 20%, 96.5% 80%, 96% 24%,
              95% 100%, 94.5% 20%, 94% 80%, 93.5% 23%, 93% 77%, 92.5% 28%,
              91.5% 100%, 91% 20%, 90.5% 80%, 90% 27%, 89.5% 73%, 89% 100%,
              88% 100%, 87.5% 20%, 87% 80%, 86.5% 31%, 86% 75%, 85.5% 100%,
              84.5% 100%, 84% 22%, 83.5% 78%, 83% 34%, 82.5% 78%, 82% 100%,
              81% 100%, 80.5% 20%, 80% 80%, 79.5% 23%, 79% 77%, 78.5% 100%,
              77.5% 100%, 77% 20%, 76.5% 80%, 76% 37%, 75.5% 70%, 75% 100%,
              74% 100%, 73.5% 20%, 73% 78%, 72.5% 39%, 72% 73%, 71.5% 100%,
              70.5% 100%, 70% 23%, 69.5% 80%, 69% 28%, 68.5% 78%, 68% 100%,
              67% 100%, 66.5% 20%, 66% 80%, 65.5% 41%, 65% 70%, 64.5% 100%,
              63.5% 100%, 63% 25%, 62.5% 80%, 62% 44%, 61.5% 77%, 61% 100%,
              60% 100%, 59.5% 20%, 59% 80%, 58.5% 47%, 58% 66%, 57.5% 100%,
              56.5% 100%, 56% 30%, 55.5% 78%, 55% 51%, 54.5% 73%, 54% 100%,
              53% 100%, 52.5% 20%, 52% 80%, 51.5% 36%, 51% 78%, 50.5% 100%,
              49.5% 100%, 49% 20%, 48.5% 80%, 48% 55%, 47.5% 62%, 47% 100%,
              46% 100%, 45.5% 33%, 45% 80%, 44.5% 42%, 44% 77%, 43.5% 100%,
              42.5% 100%, 42% 22%, 41.5% 78%, 41% 59%, 40.5% 58%, 40% 100%,
              39% 100%, 38.5% 20%, 38% 80%, 37.5% 38%, 37% 74%, 36.5% 100%,
              35.5% 100%, 35% 27%, 34.5% 80%, 34% 50%, 33.5% 78%, 33% 100%,
              32% 100%, 31.5% 20%, 31% 80%, 30.5% 62%, 30% 63%, 29.5% 100%,
              28.5% 100%, 28% 24%, 27.5% 80%, 27% 46%, 26.5% 76%, 26% 100%,
              25% 100%, 24.5% 20%, 24% 80%, 23.5% 54%, 23% 69%, 22.5% 100%,
              21.5% 100%, 21% 31%, 20.5% 80%, 20% 40%, 19.5% 77%, 19% 100%,
              18% 100%, 17.5% 20%, 17% 80%, 16.5% 58%, 16% 60%, 15.5% 100%,
              14.5% 100%, 14% 35%, 13.5% 80%, 13% 52%, 12.5% 73%, 12% 100%,
              11% 100%, 10.5% 22%, 10% 78%, 9.5% 43%, 9% 78%, 8.5% 100%,
              7.5% 100%, 7% 26%, 6.5% 80%, 6% 60%, 5.5% 62%, 5% 100%,
              4% 100%, 3.5% 20%, 3% 80%, 2.5% 49%, 2% 75%, 1.5% 100%,
              1% 29%, 0.5% 80%, 0% 39%
            )`,
            transform: 'translateY(100%)',
            pointerEvents: 'none',
          },
        }
      } else {
        // Footer: use ::before pseudo-element to extend jagged teeth above the footer
        // Maximum dramatic spikes (0-100% range) with reduced height (5px)
        return {
          ...baseStyles,
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '7px',
            background: 'inherit',
            clipPath: `polygon(
              0% 0%,
              0.5% 82%, 1% 15%, 1.5% 85%, 2% 20%, 2.5% 80%, 3% 0%,
              3.5% 78%, 4% 18%, 4.5% 85%, 5% 25%, 5.5% 75%, 6% 0%,
              6.5% 70%, 7% 15%, 7.5% 85%, 8% 30%, 8.5% 65%, 9% 0%,
              9.5% 60%, 10% 15%, 10.5% 85%, 11% 35%, 11.5% 55%, 12% 0%,
              12.5% 50%, 13% 15%, 13.5% 85%, 14% 40%, 14.5% 45%, 15% 0%,
              15.5% 83%, 16% 18%, 16.5% 85%, 17% 45%, 17.5% 38%, 18% 0%,
              18.5% 80%, 19% 15%, 19.5% 85%, 20% 33%, 20.5% 68%, 21% 0%,
              21.5% 72%, 22% 23%, 22.5% 83%, 23% 48%, 23.5% 58%, 24% 0%,
              24.5% 63%, 25% 15%, 25.5% 85%, 26% 38%, 26.5% 52%, 27% 0%,
              27.5% 47%, 28% 19%, 28.5% 83%, 29% 53%, 29.5% 42%, 30% 0%,
              30.5% 77%, 31% 15%, 31.5% 85%, 32% 42%, 32.5% 33%, 33% 0%,
              33.5% 66%, 34% 15%, 34.5% 85%, 35% 27%, 35.5% 73%, 36% 0%,
              36.5% 57%, 37% 21%, 37.5% 82%, 38% 50%, 38.5% 48%, 39% 0%,
              39.5% 78%, 40% 15%, 40.5% 85%, 41% 37%, 41.5% 62%, 42% 0%,
              42.5% 54%, 43% 18%, 43.5% 85%, 44% 46%, 44.5% 53%, 45% 0%,
              45.5% 69%, 46% 24%, 46.5% 80%, 47% 51%, 47.5% 44%, 48% 0%,
              48.5% 74%, 49% 15%, 49.5% 85%, 50% 31%, 50.5% 78%, 51% 0%,
              51.5% 59%, 52% 18%, 52.5% 82%, 53% 50%, 53.5% 39%, 54% 0%,
              54.5% 64%, 55% 15%, 55.5% 85%, 56% 41%, 56.5% 71%, 57% 0%,
              57.5% 49%, 58% 22%, 58.5% 81%, 59% 59%, 59.5% 36%, 60% 0%,
              60.5% 61%, 61% 15%, 61.5% 85%, 62% 36%, 62.5% 76%, 63% 0%,
              63.5% 67%, 64% 20%, 64.5% 83%, 65% 61%, 65.5% 34%, 66% 0%,
              66.5% 51%, 67% 15%, 67.5% 85%, 68% 49%, 68.5% 81%, 69% 0%,
              69.5% 56%, 70% 26%, 70.5% 79%, 71% 64%, 71.5% 27%, 72% 0%,
              72.5% 72%, 73% 15%, 73.5% 85%, 74% 43%, 74.5% 65%, 75% 0%,
              75.5% 47%, 76% 18%, 76.5% 83%, 77% 57%, 77.5% 43%, 78% 0%,
              78.5% 63%, 79% 29%, 79.5% 82%, 80% 53%, 80.5% 32%, 81% 0%,
              81.5% 70%, 82% 15%, 82.5% 85%, 83% 46%, 83.5% 78%, 84% 0%,
              84.5% 55%, 85% 23%, 85.5% 83%, 86% 62%, 86.5% 29%, 87% 0%,
              87.5% 66%, 88% 15%, 88.5% 85%, 89% 40%, 89.5% 73%, 90% 0%,
              90.5% 61%, 91% 18%, 91.5% 81%, 92% 58%, 92.5% 46%, 93% 0%,
              93.5% 74%, 94% 31%, 94.5% 85%, 95% 54%, 95.5% 37%, 96% 0%,
              96.5% 68%, 97% 15%, 97.5% 85%, 98% 47%, 98.5% 79%, 99% 0%,
              99.5% 58%, 100% 20%,
              100% 100%,
              0% 100%
            )`,
            transform: 'translateY(-100%)',
            pointerEvents: 'none',
          },
        }
      }
    }
    case 'False Flag': {
      // Windows 95 beveled border aesthetic
      // Classic raised button look: dark bottom/right
      // Add inner grey border and horizontal lines mimicking old computer UI
      const baseStyles = {
        borderBottom: '1px solid rgba(128, 128, 128, 0.6)',
        borderRight: '1px solid rgba(128, 128, 128, 0.6)',
        position: 'relative' as const,
        // Inner grey border (inset)
        boxShadow: 'inset 0 0 0 1px rgba(150, 150, 150, 0.4)',
      }

      if (variant === 'header') {
        // Header: horizontal lines extending down from bottom edge
        return {
          ...baseStyles,
          '&::after': {
            content: '""',
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: '100%',
            height: '7px',
            background: 'inherit',
            // Horizontal lines pattern - same thickness, same length (full width)
            clipPath: `polygon(
              0% 0%,
              100% 0%,
              100% 1%,
              0% 1%,
              0% 2%,
              100% 2%,
              100% 3%,
              0% 3%,
              0% 4%,
              100% 4%,
              100% 5%,
              0% 5%,
              0% 6%,
              100% 6%,
              100% 7%,
              0% 7%,
              0% 8%,
              100% 8%,
              100% 9%,
              0% 9%,
              0% 10%,
              100% 10%,
              100% 11%,
              0% 11%,
              0% 12%,
              100% 12%,
              100% 13%,
              0% 13%,
              0% 14%,
              100% 14%,
              100% 15%,
              0% 15%,
              0% 16%,
              100% 16%,
              100% 17%,
              0% 17%,
              0% 18%,
              100% 18%,
              100% 19%,
              0% 19%,
              0% 20%,
              100% 20%,
              100% 21%,
              0% 21%,
              0% 22%,
              100% 22%,
              100% 23%,
              0% 23%,
              0% 24%,
              100% 24%,
              100% 25%,
              0% 25%,
              0% 26%,
              100% 26%,
              100% 27%,
              0% 27%,
              0% 28%,
              100% 28%,
              100% 29%,
              0% 29%,
              0% 30%,
              100% 30%,
              100% 31%,
              0% 31%,
              0% 32%,
              100% 32%,
              100% 33%,
              0% 33%,
              0% 34%,
              100% 34%,
              100% 35%,
              0% 35%,
              0% 36%,
              100% 36%,
              100% 37%,
              0% 37%,
              0% 38%,
              100% 38%,
              100% 39%,
              0% 39%,
              0% 40%,
              100% 40%,
              100% 41%,
              0% 41%,
              0% 42%,
              100% 42%,
              100% 43%,
              0% 43%,
              0% 44%,
              100% 44%,
              100% 45%,
              0% 45%,
              0% 46%,
              100% 46%,
              100% 47%,
              0% 47%,
              0% 48%,
              100% 48%,
              100% 49%,
              0% 49%,
              0% 50%,
              100% 50%,
              100% 51%,
              0% 51%,
              0% 52%,
              100% 52%,
              100% 53%,
              0% 53%,
              0% 54%,
              100% 54%,
              100% 55%,
              0% 55%,
              0% 56%,
              100% 56%,
              100% 57%,
              0% 57%,
              0% 58%,
              100% 58%,
              100% 59%,
              0% 59%,
              0% 60%,
              100% 60%,
              100% 61%,
              0% 61%,
              0% 62%,
              100% 62%,
              100% 63%,
              0% 63%,
              0% 64%,
              100% 64%,
              100% 65%,
              0% 65%,
              0% 66%,
              100% 66%,
              100% 67%,
              0% 67%,
              0% 68%,
              100% 68%,
              100% 69%,
              0% 69%,
              0% 70%,
              100% 70%,
              100% 71%,
              0% 71%,
              0% 72%,
              100% 72%,
              100% 73%,
              0% 73%,
              0% 74%,
              100% 74%,
              100% 75%,
              0% 75%,
              0% 76%,
              100% 76%,
              100% 77%,
              0% 77%,
              0% 78%,
              100% 78%,
              100% 79%,
              0% 79%,
              0% 80%,
              100% 80%,
              100% 81%,
              0% 81%,
              0% 82%,
              100% 82%,
              100% 83%,
              0% 83%,
              0% 84%,
              100% 84%,
              100% 85%,
              0% 85%,
              0% 86%,
              100% 86%,
              100% 87%,
              0% 87%,
              0% 88%,
              100% 88%,
              100% 89%,
              0% 89%,
              0% 90%,
              100% 90%,
              100% 91%,
              0% 91%,
              0% 92%,
              100% 92%,
              100% 93%,
              0% 93%,
              0% 94%,
              100% 94%,
              100% 95%,
              0% 95%,
              0% 96%,
              100% 96%,
              100% 97%,
              0% 97%,
              0% 98%,
              100% 98%,
              100% 99%,
              0% 99%,
              0% 100%,
              100% 100%,
              0% 100%
            )`,
            transform: 'translateY(100%)',
            pointerEvents: 'none',
          },
        }
      } else {
        // Footer: horizontal lines extending up from top edge
        return {
          ...baseStyles,
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '7px',
            background: 'inherit',
            // Horizontal lines pattern - same thickness, same length (full width)
            clipPath: `polygon(
              0% 0%,
              100% 0%,
              100% 1%,
              0% 1%,
              0% 2%,
              100% 2%,
              100% 3%,
              0% 3%,
              0% 4%,
              100% 4%,
              100% 5%,
              0% 5%,
              0% 6%,
              100% 6%,
              100% 7%,
              0% 7%,
              0% 8%,
              100% 8%,
              100% 9%,
              0% 9%,
              0% 10%,
              100% 10%,
              100% 11%,
              0% 11%,
              0% 12%,
              100% 12%,
              100% 13%,
              0% 13%,
              0% 14%,
              100% 14%,
              100% 15%,
              0% 15%,
              0% 16%,
              100% 16%,
              100% 17%,
              0% 17%,
              0% 18%,
              100% 18%,
              100% 19%,
              0% 19%,
              0% 20%,
              100% 20%,
              100% 21%,
              0% 21%,
              0% 22%,
              100% 22%,
              100% 23%,
              0% 23%,
              0% 24%,
              100% 24%,
              100% 25%,
              0% 25%,
              0% 26%,
              100% 26%,
              100% 27%,
              0% 27%,
              0% 28%,
              100% 28%,
              100% 29%,
              0% 29%,
              0% 30%,
              100% 30%,
              100% 31%,
              0% 31%,
              0% 32%,
              100% 32%,
              100% 33%,
              0% 33%,
              0% 34%,
              100% 34%,
              100% 35%,
              0% 35%,
              0% 36%,
              100% 36%,
              100% 37%,
              0% 37%,
              0% 38%,
              100% 38%,
              100% 39%,
              0% 39%,
              0% 40%,
              100% 40%,
              100% 41%,
              0% 41%,
              0% 42%,
              100% 42%,
              100% 43%,
              0% 43%,
              0% 44%,
              100% 44%,
              100% 45%,
              0% 45%,
              0% 46%,
              100% 46%,
              100% 47%,
              0% 47%,
              0% 48%,
              100% 48%,
              100% 49%,
              0% 49%,
              0% 50%,
              100% 50%,
              100% 51%,
              0% 51%,
              0% 52%,
              100% 52%,
              100% 53%,
              0% 53%,
              0% 54%,
              100% 54%,
              100% 55%,
              0% 55%,
              0% 56%,
              100% 56%,
              100% 57%,
              0% 57%,
              0% 58%,
              100% 58%,
              100% 59%,
              0% 59%,
              0% 60%,
              100% 60%,
              100% 61%,
              0% 61%,
              0% 62%,
              100% 62%,
              100% 63%,
              0% 63%,
              0% 64%,
              100% 64%,
              100% 65%,
              0% 65%,
              0% 66%,
              100% 66%,
              100% 67%,
              0% 67%,
              0% 68%,
              100% 68%,
              100% 69%,
              0% 69%,
              0% 70%,
              100% 70%,
              100% 71%,
              0% 71%,
              0% 72%,
              100% 72%,
              100% 73%,
              0% 73%,
              0% 74%,
              100% 74%,
              100% 75%,
              0% 75%,
              0% 76%,
              100% 76%,
              100% 77%,
              0% 77%,
              0% 78%,
              100% 78%,
              100% 79%,
              0% 79%,
              0% 80%,
              100% 80%,
              100% 81%,
              0% 81%,
              0% 82%,
              100% 82%,
              100% 83%,
              0% 83%,
              0% 84%,
              100% 84%,
              100% 85%,
              0% 85%,
              0% 86%,
              100% 86%,
              100% 87%,
              0% 87%,
              0% 88%,
              100% 88%,
              100% 89%,
              0% 89%,
              0% 90%,
              100% 90%,
              100% 91%,
              0% 91%,
              0% 92%,
              100% 92%,
              100% 93%,
              0% 93%,
              0% 94%,
              100% 94%,
              100% 95%,
              0% 95%,
              0% 96%,
              100% 96%,
              100% 97%,
              0% 97%,
              0% 98%,
              100% 98%,
              100% 99%,
              0% 99%,
              0% 100%,
              100% 100%,
              0% 100%
            )`,
            transform: 'translateY(-100%)',
            pointerEvents: 'none',
          },
        }
      }
    }
    case 'Rainmaker': {
      // Static rain effect with vertical rain drop bars
      // Add bars representing drops of rain (vertical bars extending from edges)
      const baseStyles = {
        position: 'relative' as const,
        backgroundImage: `
          repeating-linear-gradient(
            90deg,
            transparent,
            transparent 1px,
            rgba(255, 255, 255, 0.5) 1px,
            rgba(255, 255, 255, 0.5) 2px
          )
        `,
        backgroundSize: '3px 100%',
      }

      if (variant === 'header') {
        // Header: thin vertical rain drop bars extending down from bottom edge
        return {
          ...baseStyles,
          '&::after': {
            content: '""',
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: '100%',
            height: '7px',
            background: 'inherit',
            // Thin vertical bars pattern - rain drops of varying lengths and widths
            clipPath: `polygon(
              0% 0%,
              100% 0%,
              100% 100%,
              99.8% 100%, 99.8% 12%, 99.5% 12%, 99.5% 100%,
              99.2% 100%, 99.2% 28%, 98.9% 28%, 98.9% 100%,
              98.6% 100%, 98.6% 5%, 98.3% 5%, 98.3% 100%,
              98% 100%, 98% 35%, 97.7% 35%, 97.7% 100%,
              97.4% 100%, 97.4% 18%, 97.1% 18%, 97.1% 100%,
              96.8% 100%, 96.8% 42%, 96.5% 42%, 96.5% 100%,
              96.2% 100%, 96.2% 8%, 95.9% 8%, 95.9% 100%,
              95.6% 100%, 95.6% 31%, 95.3% 31%, 95.3% 100%,
              95% 100%, 95% 22%, 94.7% 22%, 94.7% 100%,
              94.4% 100%, 94.4% 48%, 94.1% 48%, 94.1% 100%,
              93.8% 100%, 93.8% 15%, 93.5% 15%, 93.5% 100%,
              93.2% 100%, 93.2% 38%, 92.9% 38%, 92.9% 100%,
              92.6% 100%, 92.6% 7%, 92.3% 7%, 92.3% 100%,
              92% 100%, 92% 26%, 91.7% 26%, 91.7% 100%,
              91.4% 100%, 91.4% 44%, 91.1% 44%, 91.1% 100%,
              90.8% 100%, 90.8% 11%, 90.5% 11%, 90.5% 100%,
              90.2% 100%, 90.2% 33%, 89.9% 33%, 89.9% 100%,
              89.6% 100%, 89.6% 19%, 89.3% 19%, 89.3% 100%,
              89% 100%, 89% 50%, 88.7% 50%, 88.7% 100%,
              88.4% 100%, 88.4% 3%, 88.1% 3%, 88.1% 100%,
              87.8% 100%, 87.8% 29%, 87.5% 29%, 87.5% 100%,
              87.2% 100%, 87.2% 16%, 86.9% 16%, 86.9% 100%,
              86.6% 100%, 86.6% 40%, 86.3% 40%, 86.3% 100%,
              86% 100%, 86% 9%, 85.7% 9%, 85.7% 100%,
              85.4% 100%, 85.4% 24%, 85.1% 24%, 85.1% 100%,
              84.8% 100%, 84.8% 46%, 84.5% 46%, 84.5% 100%,
              84.2% 100%, 84.2% 13%, 83.9% 13%, 83.9% 100%,
              83.6% 100%, 83.6% 36%, 83.3% 36%, 83.3% 100%,
              83% 100%, 83% 21%, 82.7% 21%, 82.7% 100%,
              82.4% 100%, 82.4% 52%, 82.1% 52%, 82.1% 100%,
              81.8% 100%, 81.8% 6%, 81.5% 6%, 81.5% 100%,
              81.2% 100%, 81.2% 27%, 80.9% 27%, 80.9% 100%,
              80.6% 100%, 80.6% 14%, 80.3% 14%, 80.3% 100%,
              80% 100%, 80% 43%, 79.7% 43%, 79.7% 100%,
              79.4% 100%, 79.4% 10%, 79.1% 10%, 79.1% 100%,
              78.8% 100%, 78.8% 30%, 78.5% 30%, 78.5% 100%,
              78.2% 100%, 78.2% 17%, 77.9% 17%, 77.9% 100%,
              77.6% 100%, 77.6% 49%, 77.3% 49%, 77.3% 100%,
              77% 100%, 77% 4%, 76.7% 4%, 76.7% 100%,
              76.4% 100%, 76.4% 25%, 76.1% 25%, 76.1% 100%,
              75.8% 100%, 75.8% 39%, 75.5% 39%, 75.5% 100%,
              75.2% 100%, 75.2% 12%, 74.9% 12%, 74.9% 100%,
              74.6% 100%, 74.6% 34%, 74.3% 34%, 74.3% 100%,
              74% 100%, 74% 20%, 73.7% 20%, 73.7% 100%,
              73.4% 100%, 73.4% 47%, 73.1% 47%, 73.1% 100%,
              72.8% 100%, 72.8% 8%, 72.5% 8%, 72.5% 100%,
              72.2% 100%, 72.2% 32%, 71.9% 32%, 71.9% 100%,
              71.6% 100%, 71.6% 15%, 71.3% 15%, 71.3% 100%,
              71% 100%, 71% 41%, 70.7% 41%, 70.7% 100%,
              70.4% 100%, 70.4% 23%, 70.1% 23%, 70.1% 100%,
              69.8% 100%, 69.8% 54%, 69.5% 54%, 69.5% 100%,
              69.2% 100%, 69.2% 2%, 68.9% 2%, 68.9% 100%,
              68.6% 100%, 68.6% 28%, 68.3% 28%, 68.3% 100%,
              68% 100%, 68% 37%, 67.7% 37%, 67.7% 100%,
              67.4% 100%, 67.4% 11%, 67.1% 11%, 67.1% 100%,
              66.8% 100%, 66.8% 45%, 66.5% 45%, 66.5% 100%,
              66.2% 100%, 66.2% 19%, 65.9% 19%, 65.9% 100%,
              65.6% 100%, 65.6% 51%, 65.3% 51%, 65.3% 100%,
              65% 100%, 65% 1%, 64.7% 1%, 64.7% 100%,
              64.4% 100%, 64.4% 26%, 64.1% 26%, 64.1% 100%,
              63.8% 100%, 63.8% 35%, 63.5% 35%, 63.5% 100%,
              63.2% 100%, 63.2% 14%, 62.9% 14%, 62.9% 100%,
              62.6% 100%, 62.6% 42%, 62.3% 42%, 62.3% 100%,
              62% 100%, 62% 7%, 61.7% 7%, 61.7% 100%,
              61.4% 100%, 61.4% 30%, 61.1% 30%, 61.1% 100%,
              60.8% 100%, 60.8% 18%, 60.5% 18%, 60.5% 100%,
              60.2% 100%, 60.2% 48%, 59.9% 48%, 59.9% 100%,
              59.6% 100%, 59.6% 5%, 59.3% 5%, 59.3% 100%,
              59% 100%, 59% 24%, 58.7% 24%, 58.7% 100%,
              58.4% 100%, 58.4% 39%, 58.1% 39%, 58.1% 100%,
              57.8% 100%, 57.8% 13%, 57.5% 13%, 57.5% 100%,
              57.2% 100%, 57.2% 44%, 56.9% 44%, 56.9% 100%,
              56.6% 100%, 56.6% 22%, 56.3% 22%, 56.3% 100%,
              56% 100%, 56% 53%, 55.7% 53%, 55.7% 100%,
              55.4% 100%, 55.4% 3%, 55.1% 3%, 55.1% 100%,
              54.8% 100%, 54.8% 27%, 54.5% 27%, 54.5% 100%,
              54.2% 100%, 54.2% 16%, 53.9% 16%, 53.9% 100%,
              53.6% 100%, 53.6% 40%, 53.3% 40%, 53.3% 100%,
              53% 100%, 53% 9%, 52.7% 9%, 52.7% 100%,
              52.4% 100%, 52.4% 33%, 52.1% 33%, 52.1% 100%,
              51.8% 100%, 51.8% 20%, 51.5% 20%, 51.5% 100%,
              51.2% 100%, 51.2% 46%, 50.9% 46%, 50.9% 100%,
              50.6% 100%, 50.6% 6%, 50.3% 6%, 50.3% 100%,
              50% 100%, 50% 29%, 49.7% 29%, 49.7% 100%,
              49.4% 100%, 49.4% 15%, 49.1% 15%, 49.1% 100%,
              48.8% 100%, 48.8% 38%, 48.5% 38%, 48.5% 100%,
              48.2% 100%, 48.2% 11%, 47.9% 11%, 47.9% 100%,
              47.6% 100%, 47.6% 50%, 47.3% 50%, 47.3% 100%,
              47% 100%, 47% 4%, 46.7% 4%, 46.7% 100%,
              46.4% 100%, 46.4% 25%, 46.1% 25%, 46.1% 100%,
              45.8% 100%, 45.8% 36%, 45.5% 36%, 45.5% 100%,
              45.2% 100%, 45.2% 17%, 44.9% 17%, 44.9% 100%,
              44.6% 100%, 44.6% 43%, 44.3% 43%, 44.3% 100%,
              44% 100%, 44% 8%, 43.7% 8%, 43.7% 100%,
              43.4% 100%, 43.4% 31%, 43.1% 31%, 43.1% 100%,
              42.8% 100%, 42.8% 19%, 42.5% 19%, 42.5% 100%,
              42.2% 100%, 42.2% 49%, 41.9% 49%, 41.9% 100%,
              41.6% 100%, 41.6% 2%, 41.3% 2%, 41.3% 100%,
              41% 100%, 41% 28%, 40.7% 28%, 40.7% 100%,
              40.4% 100%, 40.4% 14%, 40.1% 14%, 40.1% 100%,
              39.8% 100%, 39.8% 41%, 39.5% 41%, 39.5% 100%,
              39.2% 100%, 39.2% 10%, 38.9% 10%, 38.9% 100%,
              38.6% 100%, 38.6% 34%, 38.3% 34%, 38.3% 100%,
              38% 100%, 38% 21%, 37.7% 21%, 37.7% 100%,
              37.4% 100%, 37.4% 47%, 37.1% 47%, 37.1% 100%,
              36.8% 100%, 36.8% 5%, 36.5% 5%, 36.5% 100%,
              36.2% 100%, 36.2% 30%, 35.9% 30%, 35.9% 100%,
              35.6% 100%, 35.6% 16%, 35.3% 16%, 35.3% 100%,
              35% 100%, 35% 39%, 34.7% 39%, 34.7% 100%,
              34.4% 100%, 34.4% 12%, 34.1% 12%, 34.1% 100%,
              33.8% 100%, 33.8% 45%, 33.5% 45%, 33.5% 100%,
              33.2% 100%, 33.2% 23%, 32.9% 23%, 32.9% 100%,
              32.6% 100%, 32.6% 52%, 32.3% 52%, 32.3% 100%,
              32% 100%, 32% 1%, 31.7% 1%, 31.7% 100%,
              31.4% 100%, 31.4% 27%, 31.1% 27%, 31.1% 100%,
              30.8% 100%, 30.8% 37%, 30.5% 37%, 30.5% 100%,
              30.2% 100%, 30.2% 13%, 29.9% 13%, 29.9% 100%,
              29.6% 100%, 29.6% 42%, 29.3% 42%, 29.3% 100%,
              29% 100%, 29% 7%, 28.7% 7%, 28.7% 100%,
              28.4% 100%, 28.4% 32%, 28.1% 32%, 28.1% 100%,
              27.8% 100%, 27.8% 18%, 27.5% 18%, 27.5% 100%,
              27.2% 100%, 27.2% 48%, 26.9% 48%, 26.9% 100%,
              26.6% 100%, 26.6% 4%, 26.3% 4%, 26.3% 100%,
              26% 100%, 26% 26%, 25.7% 26%, 25.7% 100%,
              25.4% 100%, 25.4% 35%, 25.1% 35%, 25.1% 100%,
              24.8% 100%, 24.8% 15%, 24.5% 15%, 24.5% 100%,
              24.2% 100%, 24.2% 44%, 23.9% 44%, 23.9% 100%,
              23.6% 100%, 23.6% 9%, 23.3% 9%, 23.3% 100%,
              23% 100%, 23% 31%, 22.7% 31%, 22.7% 100%,
              22.4% 100%, 22.4% 20%, 22.1% 20%, 22.1% 100%,
              21.8% 100%, 21.8% 50%, 21.5% 50%, 21.5% 100%,
              21.2% 100%, 21.2% 2%, 20.9% 2%, 20.9% 100%,
              20.6% 100%, 20.6% 28%, 20.3% 28%, 20.3% 100%,
              20% 100%, 20% 38%, 19.7% 38%, 19.7% 100%,
              19.4% 100%, 19.4% 11%, 19.1% 11%, 19.1% 100%,
              18.8% 100%, 18.8% 46%, 18.5% 46%, 18.5% 100%,
              18.2% 100%, 18.2% 6%, 17.9% 6%, 17.9% 100%,
              17.6% 100%, 17.6% 33%, 17.3% 33%, 17.3% 100%,
              17% 100%, 17% 22%, 16.7% 22%, 16.7% 100%,
              16.4% 100%, 16.4% 51%, 16.1% 51%, 16.1% 100%,
              15.8% 100%, 15.8% 3%, 15.5% 3%, 15.5% 100%,
              15.2% 100%, 15.2% 29%, 14.9% 29%, 14.9% 100%,
              14.6% 100%, 14.6% 17%, 14.3% 17%, 14.3% 100%,
              14% 100%, 14% 40%, 13.7% 40%, 13.7% 100%,
              13.4% 100%, 13.4% 8%, 13.1% 8%, 13.1% 100%,
              12.8% 100%, 12.8% 36%, 12.5% 36%, 12.5% 100%,
              12.2% 100%, 12.2% 24%, 11.9% 24%, 11.9% 100%,
              11.6% 100%, 11.6% 49%, 11.3% 49%, 11.3% 100%,
              11% 100%, 11% 5%, 10.7% 5%, 10.7% 100%,
              10.4% 100%, 10.4% 30%, 10.1% 30%, 10.1% 100%,
              9.8% 100%, 9.8% 19%, 9.5% 19%, 9.5% 100%,
              9.2% 100%, 9.2% 43%, 8.9% 43%, 8.9% 100%,
              8.6% 100%, 8.6% 7%, 8.3% 7%, 8.3% 100%,
              8% 100%, 8% 34%, 7.7% 34%, 7.7% 100%,
              7.4% 100%, 7.4% 14%, 7.1% 14%, 7.1% 100%,
              6.8% 100%, 6.8% 47%, 6.5% 47%, 6.5% 100%,
              6.2% 100%, 6.2% 1%, 5.9% 1%, 5.9% 100%,
              5.6% 100%, 5.6% 26%, 5.3% 26%, 5.3% 100%,
              5% 100%, 5% 37%, 4.7% 37%, 4.7% 100%,
              4.4% 100%, 4.4% 10%, 4.1% 10%, 4.1% 100%,
              3.8% 100%, 3.8% 41%, 3.5% 41%, 3.5% 100%,
              3.2% 100%, 3.2% 21%, 2.9% 21%, 2.9% 100%,
              2.6% 100%, 2.6% 55%, 2.3% 55%, 2.3% 100%,
              2% 100%, 2% 4%, 1.7% 4%, 1.7% 100%,
              1.4% 100%, 1.4% 31%, 1.1% 31%, 1.1% 100%,
              0.8% 100%, 0.8% 16%, 0.5% 16%, 0.5% 100%,
              0.2% 100%, 0.2% 45%, 0% 45%,
              0% 100%
            )`,
            transform: 'translateY(100%)',
            pointerEvents: 'none',
          },
        }
      } else {
        // Footer: thin vertical rain drop bars extending up from top edge
        return {
          ...baseStyles,
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '7px',
            background: 'inherit',
            // Thin vertical bars pattern - rain drops of varying lengths and widths
            clipPath: `polygon(
              0% 0%,
              0.2% 88%, 0.5% 88%, 0.5% 0%,
              0.8% 0%, 0.8% 71%, 1.1% 71%, 1.1% 0%,
              1.4% 0%, 1.4% 93%, 1.7% 93%, 1.7% 0%,
              2% 0%, 2% 64%, 2.3% 64%, 2.3% 0%,
              2.6% 0%, 2.6% 82%, 2.9% 82%, 2.9% 0%,
              3.2% 0%, 3.2% 57%, 3.5% 57%, 3.5% 0%,
              3.8% 0%, 3.8% 95%, 4.1% 95%, 4.1% 0%,
              4.4% 0%, 4.4% 69%, 4.7% 69%, 4.7% 0%,
              5% 0%, 5% 78%, 5.3% 78%, 5.3% 0%,
              5.6% 0%, 5.6% 61%, 5.9% 61%, 5.9% 0%,
              6.2% 0%, 6.2% 86%, 6.5% 86%, 6.5% 0%,
              6.8% 0%, 6.8% 73%, 7.1% 73%, 7.1% 0%,
              7.4% 0%, 7.4% 54%, 7.7% 54%, 7.7% 0%,
              8% 0%, 8% 91%, 8.3% 91%, 8.3% 0%,
              8.6% 0%, 8.6% 67%, 8.9% 67%, 8.9% 0%,
              9.2% 0%, 9.2% 80%, 9.5% 80%, 9.5% 0%,
              9.8% 0%, 9.8% 59%, 10.1% 59%, 10.1% 0%,
              10.4% 0%, 10.4% 89%, 10.7% 89%, 10.7% 0%,
              11% 0%, 11% 75%, 11.3% 75%, 11.3% 0%,
              11.6% 0%, 11.6% 52%, 11.9% 52%, 11.9% 0%,
              12.2% 0%, 12.2% 84%, 12.5% 84%, 12.5% 0%,
              12.8% 0%, 12.8% 70%, 13.1% 70%, 13.1% 0%,
              13.4% 0%, 13.4% 63%, 13.7% 63%, 13.7% 0%,
              14% 0%, 14% 97%, 14.3% 97%, 14.3% 0%,
              14.6% 0%, 14.6% 77%, 14.9% 77%, 14.9% 0%,
              15.2% 0%, 15.2% 56%, 15.5% 56%, 15.5% 0%,
              15.8% 0%, 15.8% 87%, 16.1% 87%, 16.1% 0%,
              16.4% 0%, 16.4% 72%, 16.7% 72%, 16.7% 0%,
              17% 0%, 17% 65%, 17.3% 65%, 17.3% 0%,
              17.6% 0%, 17.6% 94%, 17.9% 94%, 17.9% 0%,
              18.2% 0%, 18.2% 58%, 18.5% 58%, 18.5% 0%,
              18.8% 0%, 18.8% 81%, 19.1% 81%, 19.1% 0%,
              19.4% 0%, 19.4% 68%, 19.7% 68%, 19.7% 0%,
              20% 0%, 20% 92%, 20.3% 92%, 20.3% 0%,
              20.6% 0%, 20.6% 74%, 20.9% 74%, 20.9% 0%,
              21.2% 0%, 21.2% 60%, 21.5% 60%, 21.5% 0%,
              21.8% 0%, 21.8% 85%, 22.1% 85%, 22.1% 0%,
              22.4% 0%, 22.4% 53%, 22.7% 53%, 22.7% 0%,
              23% 0%, 23% 90%, 23.3% 90%, 23.3% 0%,
              23.6% 0%, 23.6% 66%, 23.9% 66%, 23.9% 0%,
              24.2% 0%, 24.2% 79%, 24.5% 79%, 24.5% 0%,
              24.8% 0%, 24.8% 62%, 25.1% 62%, 25.1% 0%,
              25.4% 0%, 25.4% 96%, 25.7% 96%, 25.7% 0%,
              26% 0%, 26% 55%, 26.3% 55%, 26.3% 0%,
              26.6% 0%, 26.6% 83%, 26.9% 83%, 26.9% 0%,
              27.2% 0%, 27.2% 71%, 27.5% 71%, 27.5% 0%,
              27.8% 0%, 27.8% 64%, 28.1% 64%, 28.1% 0%,
              28.4% 0%, 28.4% 88%, 28.7% 88%, 28.7% 0%,
              29% 0%, 29% 76%, 29.3% 76%, 29.3% 0%,
              29.6% 0%, 29.6% 51%, 29.9% 51%, 29.9% 0%,
              30.2% 0%, 30.2% 86%, 30.5% 86%, 30.5% 0%,
              30.8% 0%, 30.8% 73%, 31.1% 73%, 31.1% 0%,
              31.4% 0%, 31.4% 58%, 31.7% 58%, 31.7% 0%,
              32% 0%, 32% 93%, 32.3% 93%, 32.3% 0%,
              32.6% 0%, 32.6% 69%, 32.9% 69%, 32.9% 0%,
              33.2% 0%, 33.2% 82%, 33.5% 82%, 33.5% 0%,
              33.8% 0%, 33.8% 56%, 34.1% 56%, 34.1% 0%,
              34.4% 0%, 34.4% 91%, 34.7% 91%, 34.7% 0%,
              35% 0%, 35% 75%, 35.3% 75%, 35.3% 0%,
              35.6% 0%, 35.6% 63%, 35.9% 63%, 35.9% 0%,
              36.2% 0%, 36.2% 95%, 36.5% 95%, 36.5% 0%,
              36.8% 0%, 36.8% 54%, 37.1% 54%, 37.1% 0%,
              37.4% 0%, 37.4% 84%, 37.7% 84%, 37.7% 0%,
              38% 0%, 38% 72%, 38.3% 72%, 38.3% 0%,
              38.6% 0%, 38.6% 61%, 38.9% 61%, 38.9% 0%,
              39.2% 0%, 39.2% 89%, 39.5% 89%, 39.5% 0%,
              39.8% 0%, 39.8% 77%, 40.1% 77%, 40.1% 0%,
              40.4% 0%, 40.4% 59%, 40.7% 59%, 40.7% 0%,
              41% 0%, 41% 87%, 41.3% 87%, 41.3% 0%,
              41.6% 0%, 41.6% 68%, 41.9% 68%, 41.9% 0%,
              42.2% 0%, 42.2% 98%, 42.5% 98%, 42.5% 0%,
              42.8% 0%, 42.8% 52%, 43.1% 52%, 43.1% 0%,
              43.4% 0%, 43.4% 81%, 43.7% 81%, 43.7% 0%,
              44% 0%, 44% 74%, 44.3% 74%, 44.3% 0%,
              44.6% 0%, 44.6% 57%, 44.9% 57%, 44.9% 0%,
              45.2% 0%, 45.2% 92%, 45.5% 92%, 45.5% 0%,
              45.8% 0%, 45.8% 66%, 46.1% 66%, 46.1% 0%,
              46.4% 0%, 46.4% 79%, 46.7% 79%, 46.7% 0%,
              47% 0%, 47% 50%, 47.3% 50%, 47.3% 0%,
              47.6% 0%, 47.6% 85%, 47.9% 85%, 47.9% 0%,
              48.2% 0%, 48.2% 70%, 48.5% 70%, 48.5% 0%,
              48.8% 0%, 48.8% 62%, 49.1% 62%, 49.1% 0%,
              49.4% 0%, 49.4% 96%, 49.7% 97%, 49.7% 0%,
              50% 0%, 50% 55%, 50.3% 55%, 50.3% 0%,
              50.6% 0%, 50.6% 83%, 50.9% 83%, 50.9% 0%,
              51.2% 0%, 51.2% 73%, 51.5% 73%, 51.5% 0%,
              51.8% 0%, 51.8% 60%, 52.1% 60%, 52.1% 0%,
              52.4% 0%, 52.4% 90%, 52.7% 90%, 52.7% 0%,
              53% 0%, 53% 67%, 53.3% 67%, 53.3% 0%,
              53.6% 0%, 53.6% 78%, 53.9% 78%, 53.9% 0%,
              54.2% 0%, 54.2% 58%, 54.5% 58%, 54.5% 0%,
              54.8% 0%, 54.8% 94%, 55.1% 94%, 55.1% 0%,
              55.4% 0%, 55.4% 65%, 55.7% 65%, 55.7% 0%,
              56% 0%, 56% 86%, 56.3% 86%, 56.3% 0%,
              56.6% 0%, 56.6% 71%, 56.9% 71%, 56.9% 0%,
              57.2% 0%, 57.2% 53%, 57.5% 53%, 57.5% 0%,
              57.8% 0%, 57.8% 88%, 58.1% 88%, 58.1% 0%,
              58.4% 0%, 58.4% 76%, 58.7% 76%, 58.7% 0%,
              59% 0%, 59% 61%, 59.3% 61%, 59.3% 0%,
              59.6% 0%, 59.6% 91%, 59.9% 91%, 59.9% 0%,
              60.2% 0%, 60.2% 68%, 60.5% 68%, 60.5% 0%,
              60.8% 0%, 60.8% 80%, 61.1% 80%, 61.1% 0%,
              61.4% 0%, 61.4% 56%, 61.7% 56%, 61.7% 0%,
              62% 0%, 62% 93%, 62.3% 93%, 62.3% 0%,
              62.6% 0%, 62.6% 69%, 62.9% 69%, 62.9% 0%,
              63.2% 0%, 63.2% 82%, 63.5% 82%, 63.5% 0%,
              63.8% 0%, 63.8% 64%, 64.1% 64%, 64.1% 0%,
              64.4% 0%, 64.4% 95%, 64.7% 95%, 64.7% 0%,
              65% 0%, 65% 51%, 65.3% 51%, 65.3% 0%,
              65.6% 0%, 65.6% 87%, 65.9% 87%, 65.9% 0%,
              66.2% 0%, 66.2% 74%, 66.5% 74%, 66.5% 0%,
              66.8% 0%, 66.8% 59%, 67.1% 59%, 67.1% 0%,
              67.4% 0%, 67.4% 89%, 67.7% 89%, 67.7% 0%,
              68% 0%, 68% 72%, 68.3% 72%, 68.3% 0%,
              68.6% 0%, 68.6% 63%, 68.9% 63%, 68.9% 0%,
              69.2% 0%, 69.2% 97%, 69.5% 97%, 69.5% 0%,
              69.8% 0%, 69.8% 54%, 70.1% 54%, 70.1% 0%,
              70.4% 0%, 70.4% 85%, 70.7% 85%, 70.7% 0%,
              71% 0%, 71% 75%, 71.3% 75%, 71.3% 0%,
              71.6% 0%, 71.6% 57%, 71.9% 57%, 71.9% 0%,
              72.2% 0%, 72.2% 92%, 72.5% 92%, 72.5% 0%,
              72.8% 0%, 72.8% 70%, 73.1% 70%, 73.1% 0%,
              73.4% 0%, 73.4% 81%, 73.7% 81%, 73.7% 0%,
              74% 0%, 74% 65%, 74.3% 65%, 74.3% 0%,
              74.6% 0%, 74.6% 96%, 74.9% 96%, 74.9% 0%,
              75.2% 0%, 75.2% 52%, 75.5% 52%, 75.5% 0%,
              75.8% 0%, 75.8% 84%, 76.1% 84%, 76.1% 0%,
              76.4% 0%, 76.4% 73%, 76.7% 73%, 76.7% 0%,
              77% 0%, 77% 60%, 77.3% 60%, 77.3% 0%,
              77.6% 0%, 77.6% 90%, 77.9% 90%, 77.9% 0%,
              78.2% 0%, 78.2% 67%, 78.5% 67%, 78.5% 0%,
              78.8% 0%, 78.8% 79%, 79.1% 79%, 79.1% 0%,
              79.4% 0%, 79.4% 58%, 79.7% 58%, 79.7% 0%,
              80% 0%, 80% 94%, 80.3% 94%, 80.3% 0%,
              80.6% 0%, 80.6% 71%, 80.9% 71%, 80.9% 0%,
              81.2% 0%, 81.2% 83%, 81.5% 83%, 81.5% 0%,
              81.8% 0%, 81.8% 55%, 82.1% 55%, 82.1% 0%,
              82.4% 0%, 82.4% 88%, 82.7% 88%, 82.7% 0%,
              83% 0%, 83% 76%, 83.3% 76%, 83.3% 0%,
              83.6% 0%, 83.6% 62%, 83.9% 62%, 83.9% 0%,
              84.2% 0%, 84.2% 91%, 84.5% 91%, 84.5% 0%,
              84.8% 0%, 84.8% 68%, 85.1% 68%, 85.1% 0%,
              85.4% 0%, 85.4% 80%, 85.7% 80%, 85.7% 0%,
              86% 0%, 86% 56%, 86.3% 56%, 86.3% 0%,
              86.6% 0%, 86.6% 93%, 86.9% 93%, 86.9% 0%,
              87.2% 0%, 87.2% 69%, 87.5% 69%, 87.5% 0%,
              87.8% 0%, 87.8% 82%, 88.1% 82%, 88.1% 0%,
              88.4% 0%, 88.4% 64%, 88.7% 64%, 88.7% 0%,
              89% 0%, 89% 95%, 89.3% 95%, 89.3% 0%,
              89.6% 0%, 89.6% 53%, 89.9% 53%, 89.9% 0%,
              90.2% 0%, 90.2% 86%, 90.5% 86%, 90.5% 0%,
              90.8% 0%, 90.8% 75%, 91.1% 75%, 91.1% 0%,
              91.4% 0%, 91.4% 61%, 91.7% 61%, 91.7% 0%,
              92% 0%, 92% 89%, 92.3% 89%, 92.3% 0%,
              92.6% 0%, 92.6% 72%, 92.9% 72%, 92.9% 0%,
              93.2% 0%, 93.2% 78%, 93.5% 78%, 93.5% 0%,
              93.8% 0%, 93.8% 59%, 94.1% 59%, 94.1% 0%,
              94.4% 0%, 94.4% 97%, 94.7% 97%, 94.7% 0%,
              95% 0%, 95% 50%, 95.3% 50%, 95.3% 0%,
              95.6% 0%, 95.6% 85%, 95.9% 85%, 95.9% 0%,
              96.2% 0%, 96.2% 73%, 96.5% 73%, 96.5% 0%,
              96.8% 0%, 96.8% 63%, 97.1% 63%, 97.1% 0%,
              97.4% 0%, 97.4% 91%, 97.7% 91%, 97.7% 0%,
              98% 0%, 98% 68%, 98.3% 68%, 98.3% 0%,
              98.6% 0%, 98.6% 81%, 98.9% 81%, 98.9% 0%,
              99.2% 0%, 99.2% 57%, 99.5% 57%, 99.5% 0%,
              99.8% 0%, 99.8% 94%, 100% 94%,
              100% 100%,
              0% 100%
            )`,
            transform: 'translateY(-100%)',
            pointerEvents: 'none',
          },
        }
      }
    }
    default:
      return {}
  }
}
