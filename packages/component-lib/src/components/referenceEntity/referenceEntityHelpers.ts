import type { CSSProperties } from 'react'
import type {
  SURefMetaEntity,
  SURefEnumSchemaName,
  SURefObjectBonusPerTechLevel,
} from 'salvageunion-reference'
import { getBlackMarket, isEntityData, getHybridClasses } from 'salvageunion-reference'

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
    return 'bg-ink-2'
  }

  if (schemaName === 'chassis') return 'bg-mech'
  if (schemaName === 'crawlers') return headerColor || 'bg-crawler'
  if (schemaName === 'crawler-tech-levels') return headerColor || 'bg-crawler'
  if (schemaName === 'crawler-bays') return headerColor || 'bg-crawler'
  if (schemaName === 'creatures') return headerColor || 'bg-adversary'
  if (schemaName === 'bio-titans') return headerColor || 'bg-adversary'
  if (schemaName === 'factions') return headerColor || 'bg-adversary'
  if (schemaName === 'npcs') return headerColor || 'bg-adversary'
  if (schemaName === 'meld') return headerColor || 'bg-adversary'
  if (schemaName === 'squads') return headerColor || 'bg-adversary'
  if (schemaName === 'keywords') return headerColor || 'bg-ink-2'
  if (schemaName === 'distances') return headerColor || 'bg-ink-2'
  if (schemaName === 'traits') return headerColor || 'bg-ink-2'
  if (schemaName === 'guides') return headerColor || 'bg-ink-2'
  if (schemaName === 'roll-tables') return headerColor || 'bg-ink-2'
  if (schemaName === 'sources') return headerColor || 'bg-ink-2'
  // Classes are pilot-domain → orange. Hybrid classes render as pilot-orange
  // spreads in the book too (pink is the Legendary tier, not a class type).
  if (schemaName === 'classes') return headerColor || 'bg-pilot'

  if (schemaName === 'abilities' && !headerColor) {
    const isLegendary =
      ('level' in data && String(data.level).toUpperCase() === 'L') ||
      ('tree' in data && String(data.tree).includes('Legendary'))
    const treeName = 'tree' in data ? String(data.tree) : ''
    const isAdvancedOrHybrid = treeName.includes('Advanced') || getHybridTreeNames().has(treeName)

    // Book tier tones (Core Book 2.0a, class ability-tree spreads): Core = brick,
    // Advanced (incl. Hybrid) = orange, Legendary = pink. Hybrid folds into Advanced.
    if (isLegendary) {
      return 'bg-crawler'
    } else if (isAdvancedOrHybrid) {
      return 'bg-pilot'
    } else {
      return 'bg-tier-core'
    }
  }

  if (schemaName === 'ability-tree-requirements' && !headerColor) {
    const name = 'name' in data ? String(data.name).toLowerCase() : ''
    if (name.includes('legendary')) {
      return 'bg-crawler'
    } else if (name.includes('advanced') || name.includes('hybrid')) {
      return 'bg-pilot'
    }
    return 'bg-tier-core'
  }

  if (headerColor) return headerColor
  if (techLevel) return techLevelColors[techLevel] ?? 'bg-pilot'
  return 'bg-pilot'
}

/**
 * Derive a CSS color value from a Tailwind bg class (e.g. 'bg-pilot' → 'var(--color-pilot)').
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
 * Deeper still — the SUB-header band, one step below the header band.
 *
 * The header band moved down onto `accentDeepColor` (see `bandSurface`), so the
 * sub-header had to move with it or the two would have rendered as one flat
 * block. The ramp is unchanged in shape, just shifted: base → deep → deeper.
 */
export function accentDeeperColor(
  headerBg: string | undefined,
  headerBgColor?: string
): string | undefined {
  const base = borderColorFromHeaderBg(headerBg, headerBgColor)
  return base ? `color-mix(in srgb, ${base} 45%, black)` : undefined
}

/**
 * The HEADER BAND's fill — the accent surface, darkened.
 *
 * ## Why the band is not the base tone any more
 *
 * A card states its name in paper-white directly on this band, and measured
 * against the base tones that text was never legible: 2.41:1 on pilot orange
 * and 1.69:1 on game blue, against a 4.5:1 AA floor. No choice of white fixes
 * it — contrast against a LIGHT ground improves as the text darkens, so a
 * "safer white" is a contradiction. Either the text goes ink, or the band goes
 * dark; this is the latter, which keeps the white title the design wants.
 *
 * On the deep fill the same four ontologies measure 5.17 / 10.16 / 8.49 / 8.12
 * — AA across the board, with the worst case now better than the best case was.
 *
 * An UNTONED card is returned unchanged: there is no base colour to darken, its
 * band is paper, and its title is ink. Darkening nothing would paint a black
 * band under black text.
 *
 * `deep: false` opts out for the same reason in the other direction. A DAMAGED,
 * DESTROYED or GHOSTED card keeps an ink title on a grey band, and darkening
 * that band takes it from 4.87:1 to 2.40:1 — this fix, applied blindly, would
 * have broken the very thing it exists to fix. The caller that knows the title
 * is ink is the caller that must say so.
 */
export function bandSurface(
  headerBg: string | undefined,
  headerBgColor: string | undefined,
  deep = true
): { className: string; style: CSSProperties | undefined } {
  if (!deep) return accentSurface(headerBg, headerBgColor)
  const fill = accentDeepColor(headerBg, headerBgColor)
  if (!fill) return accentSurface(headerBg, headerBgColor)
  return { className: '', style: { backgroundColor: fill } }
}
