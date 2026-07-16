import type { SURefEnumSchemaName, SURefMetaEntity } from 'salvageunion-reference'
import { getDisplayName, getTechLevel, getTechLevelNumber, isAbility } from 'salvageunion-reference'
import type { StatItem } from '../../shared/statsBarTypes'
import { TECH_LEVEL_BG } from '../../shared/techLevelStyles'
import { calculateBackgroundColor } from '../referenceEntityHelpers'
import type { NEWCardDomain } from './EntityCardIdentityFooter'

/** The three densities a `ReferenceEntityCard` renders at. Nested entities
 * are ALWAYS 'compact'; 'listing' uses the same compact header treatment,
 * rendered as a solid full-colour domain row. */
export type ReferenceEntityCardSize = 'full' | 'compact' | 'listing'

/**
 * MONSTER/actor domain tone (approved L1 mockup): a dark navy, NOT the legacy
 * rust used by `calculateBackgroundColor` for creatures/bio-titans/NPCs/etc.
 * Reuses the tech-level-6 token as the navy swatch — it is the darkest, most
 * desaturated blue already in the palette.
 */
export const NEW_MONSTER_TONE = 'var(--color-tl-6)'

/** Schemas that read as an "actor" on the mockup's second axis — always navy. */
const ACTOR_SCHEMAS = new Set<SURefEnumSchemaName>([
  'bio-titans',
  'creatures',
  'npcs',
  'factions',
  'squads',
  'meld',
])

/** Schemas that are "gear" — coloured by TECH LEVEL, not by domain. */
const GEAR_SCHEMAS = new Set<SURefEnumSchemaName>([
  'systems',
  'modules',
  'equipment',
  'drones',
  'vehicles',
])

export type NEWDomainTone = {
  domain: NEWCardDomain
  bg: string | undefined
  bgColor: string | undefined
  /** Tailwind text-colour class (`text-ink` / `text-paper`) that reads against
   * this tone — for the title text sitting directly on the header band. */
  onToneText: string
}

/** Paper text on dark tones (navy monster, crawler pink, TL3+ gear); ink text on
 * the light warm tones (pilot orange, mech green, TL1/TL2/Bio/Nanite gear). */
function resolveOnToneText(
  domain: NEWCardDomain,
  bg: string | undefined,
  bgColor: string | undefined
): string {
  if (domain === 'monster' || domain === 'crawler') return 'text-paper'
  if (domain === 'pilot' || domain === 'mech') return 'text-ink'
  // gear: keyed off tech-level band — tl-3..6 are dark, tl-1/tl-2 and Bio/Nanite are light.
  const source = bg ?? bgColor ?? ''
  const match = source.match(/tl-(\d)/)
  if (match?.[1]) return Number(match[1]) >= 3 ? 'text-paper' : 'text-ink'
  return 'text-ink'
}

/** The two-axis colour resolution: DOMAIN tone, or TECH-LEVEL blue for gear. */
export function resolveDomainTone(
  schemaName: SURefEnumSchemaName,
  entity: SURefMetaEntity
): NEWDomainTone {
  if (ACTOR_SCHEMAS.has(schemaName)) {
    return {
      domain: 'monster',
      bg: undefined,
      bgColor: NEW_MONSTER_TONE,
      onToneText: 'text-paper',
    }
  }

  const techLevel = getTechLevel(entity)
  if (GEAR_SCHEMAS.has(schemaName) && techLevel != null) {
    if (typeof techLevel === 'number') {
      const bg = TECH_LEVEL_BG[techLevel]
      return {
        domain: 'gear',
        bg,
        bgColor: undefined,
        onToneText: resolveOnToneText('gear', bg, undefined),
      }
    }
    const bgColor = `var(--color-tl-${String(techLevel).toLowerCase()})`
    return {
      domain: 'gear',
      bg: undefined,
      bgColor,
      onToneText: resolveOnToneText('gear', undefined, bgColor),
    }
  }

  const bg = calculateBackgroundColor(
    schemaName,
    '',
    getTechLevelNumber(entity),
    entity,
    TECH_LEVEL_BG
  )
  const domain: NEWCardDomain = bg.includes('orange')
    ? 'pilot'
    : bg.includes('green')
      ? 'mech'
      : bg.includes('pink')
        ? 'crawler'
        : 'gear'
  return { domain, bg, bgColor: undefined, onToneText: resolveOnToneText(domain, bg, undefined) }
}

/**
 * Ghosted action bands (D8): desaturate + lighten the HOST (summoning parent)
 * entity's tone toward a warm grey, so a nested action reads as a faded relative
 * of the entity that owns it — same colour family, clearly secondary. The card
 * and the `ActionDirections` brainstorm share this ONE implementation. `hostBase`
 * is the parent's tone as a resolvable CSS colour (`var(--color-…)` / rgb()).
 */
export function ghostActionTone(hostBase: string): {
  header: string
  sub: string
  frame: string
} {
  return {
    header: `color-mix(in srgb, ${hostBase} 32%, rgb(233, 230, 222))`,
    sub: `color-mix(in srgb, ${hostBase} 46%, rgb(233, 230, 222))`,
    frame: `color-mix(in srgb, ${hostBase} 55%, rgb(184, 178, 165))`,
  }
}

/**
 * The ONE tone resolver for the unified card. Entities resolve to their domain
 * hue / tech-level band. ACTIONS carry no tone of their own — they inherit their
 * host entity's tone, ghosted (resolved by the card from the parent tone), so
 * this returns a neutral placeholder for them that the card overrides.
 */
export function resolveCardTone(
  schemaName: SURefEnumSchemaName | 'actions',
  entity: SURefMetaEntity
): NEWDomainTone {
  if (schemaName === 'actions') {
    return { domain: 'action', bg: undefined, bgColor: undefined, onToneText: 'text-ink' }
  }
  return resolveDomainTone(schemaName, entity)
}

/**
 * DEPTH = nesting level → title type scale. depth 0 (full/solo) is the dominant
 * name-tab; every nesting level steps the header font DOWN one rung, floored at
 * `text-badge` so deeply-nested cards stay legible.
 */
const TITLE_SIZE_LADDER = ['text-5xl', 'text-xl', 'text-base', 'text-sm'] as const

export function titleSizeClass(depth: number): string {
  const index = Math.min(Math.max(depth, 0), TITLE_SIZE_LADDER.length - 1)
  return TITLE_SIZE_LADDER[index] ?? 'text-badge'
}

export type NEWEyebrow = { type: string }

/**
 * Eyebrow = the schema TYPE stamp only (e.g. "Ability", "System"). The
 * categorical classification axis (ability tree, tech level) no longer lives
 * in this Stamp — it rides the header's top-border seam instead, via
 * {@link resolveAxisMarker}.
 */
export function resolveEyebrow(schemaName: SURefEnumSchemaName | 'actions'): NEWEyebrow {
  if (schemaName === 'actions') return { type: 'Action' }
  // The crawler CLASS type reads "Crawler Type" (not just "Crawler").
  if (schemaName === 'crawlers') return { type: 'Crawler Type' }
  return { type: getDisplayName(schemaName) }
}

export type NEWAxisMarker = { label: string; value: string }

/**
 * The categorical classification axis (Ability Tree, Level, Tech Level) — the
 * mockup's "second axis" — as an ORDERED list of pills the card renders in the
 * StampSeam riding the header's top border (each an `xs` horizontal
 * `StatDisplay`, e.g. "ABILITY TREE · FORGING" / "LEVEL · 3" / "TECH LEVEL ·
 * 2"). Entity-type-specific:
 *
 * - ABILITIES → `[Ability Tree | <tree>]` then `[Level | <n>]` (each only when
 *   present).
 * - TECH-LEVEL-ABLE entities (systems/modules/equipment/drones/vehicles — any
 *   entity carrying a `techLevel`) → `[Tech Level | <n>]`.
 * - Everything else → `[]` (just the TYPE stamp, no axis pills).
 *
 * Numeric vitals (SP/EP/Heat/Structure) stay in the header's top-right stat
 * cluster; only this classification axis lives in the seam.
 */
export function resolveAxisMarkers(entity: SURefMetaEntity): NEWAxisMarker[] {
  // Only ABILITY classification pills (Ability Tree / Level) live in the seam.
  // TECH LEVEL moved to the header's top-right main stat cluster (a value box).
  if (isAbility(entity)) {
    const markers: NEWAxisMarker[] = []
    if (entity.tree) markers.push({ label: 'Ability Tree', value: String(entity.tree) })
    if (entity.level != null) markers.push({ label: 'Level', value: String(entity.level) })
    return markers
  }
  return []
}

/**
 * Header stat-box label abbreviations (L1 mockup): the top-right stat cluster
 * uses short glyphs, not full names. Applied to a StatItem's `label`, with the
 * `bottomLabel` cleared so the box shows just the short label + value.
 */
const STAT_LABEL_ABBR: Record<string, string> = {
  // The single compact-label map (full top-label → shortform). Compact drops the
  // bottom label entirely; each stat becomes ONE short token. The cell uppercases,
  // so case here is cosmetic. Tech Level → "TL" is handled where the stat is built.
  Slots: 'SLOTS',
  Structure: 'SP',
  Hit: 'HP',
  Energy: 'EP',
  Salvage: 'SV',
  Bio: 'BIO SV',
  'BIO-SALVAGE': 'BIO SV',
  System: 'SYS',
  Module: 'MOD',
  Cargo: 'CARGO',
  Heat: 'HEAT',
}

/** Abbreviate a header stat's label (Structure Points → SP, …) and drop the
 * bottom label. Unknown labels pass through untouched. */
export function abbreviateStat(stat: StatItem): StatItem {
  const short = STAT_LABEL_ABBR[stat.label]
  if (!short) return stat
  return { ...stat, label: short, bottomLabel: undefined }
}
