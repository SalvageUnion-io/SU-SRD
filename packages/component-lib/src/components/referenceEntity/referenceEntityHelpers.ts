import type { CSSProperties } from 'react'
import type {
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectBonusPerTechLevel,
} from 'salvageunion-reference'
import { getBlackMarket, getHybridClasses, isEntityData } from 'salvageunion-reference'
import type { Foreground } from '../../design/contrast'
import { foregroundOn } from '../../design/contrast'

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
 * Deeper (darker) tint of the card's accent (header) colour — the "deep" variant:
 * the sub-header and footer bands, and the white body box's 3px left accent border.
 *
 * 60% tone, not the 65% it was: the footer prints 12px text on this band, which
 * owes 4.5:1, and TL1's deep shade at 65% gave its best foreground (paper) only
 * 4.05:1. At 60% every card tone clears 4.5:1 — `design/contrast.test.ts` holds it.
 */
export function accentDeepColor(
  headerBg: string | undefined,
  headerBgColor?: string
): string | undefined {
  const base = borderColorFromHeaderBg(headerBg, headerBgColor)
  return base ? `color-mix(in srgb, ${base} 60%, black)` : undefined
}

/** The text-colour class for each foreground a band may print in. */
export type OnToneText = 'text-ink' | 'text-paper'

const ON_TONE_TEXT: Record<Foreground, OnToneText> = { ink: 'text-ink', paper: 'text-paper' }

/**
 * The text class for a tone band (header, sub-header, footer): ink or paper,
 * whichever contrasts more with the band actually painted — see
 * `design/contrast.ts`. `fallback` covers a band the arithmetic cannot resolve.
 */
export function onToneText(
  band: string | undefined,
  fallback: OnToneText = 'text-paper'
): OnToneText {
  return ON_TONE_TEXT[foregroundOn(band, fallback === 'text-ink' ? 'ink' : 'paper')]
}
