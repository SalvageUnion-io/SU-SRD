import type { SURefEnumSchemaName, SURefMetaEntity } from 'salvageunion-reference'
import { getDisplayName, getTechLevel, getTechLevelNumber, isAbility } from 'salvageunion-reference'
import type { StatItem } from '../../shared/statsBarTypes'
import { TECH_LEVEL_BG } from '../../shared/techLevelStyles'
import { borderColorFromHeaderBg, calculateBackgroundColor } from '../referenceEntityHelpers'
import type { NEWCardDomain } from './EntityCardIdentityFooter'

/** The densities a `ReferenceEntityCard` renders at. Nested entities are ALWAYS
 * 'compact'; 'listing' uses the same compact header treatment, rendered as a
 * solid full-colour domain row; 'badge' is the SHORTFORM token — a single
 * tone-filled pill showing only the type stamp, name, and TL / Tree · Level. */
export type ReferenceEntityCardSize = 'full' | 'compact' | 'listing' | 'badge'

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
    // Non-numeric tiers (Bio / Nanite) use the bg-tl-b / bg-tl-n UTILITY classes
    // — LITERAL strings so Tailwind actually emits them, matching how numeric
    // TLs use bg-tl-1..6. An inline `var(--color-tl-n)` was never emitted as a
    // utility, so it failed to resolve and the band fell back to ink.
    const bg = techLevel === 'B' ? 'bg-tl-b' : 'bg-tl-n'
    return {
      domain: 'gear',
      bg,
      bgColor: undefined,
      onToneText: resolveOnToneText('gear', bg, undefined),
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
 * The parent entity's tone base as a resolvable CSS colour — the value a host
 * (chassis, mech, sheet) threads to its actions/abilities via the card's
 * `hostTone` prop, which the child then ghosts. Consumers rendering a parent's
 * actions/abilities pass `hostTone={entityHostTone(parent)}`.
 */
export function entityHostTone(entity: SURefMetaEntity): string {
  const schemaName = (entity as { schemaName?: string }).schemaName as
    | SURefEnumSchemaName
    | 'actions'
  const tone = resolveCardTone(schemaName, entity)
  return borderColorFromHeaderBg(tone.bg, tone.bgColor) ?? 'var(--color-ink)'
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

export type NEWAxisMarker = { label: string; value?: string }

/**
 * The categorical classification axis (Ability Tree · Level, Tech Level) — the
 * mockup's "second axis" — as an ORDERED list of pills the card renders in the
 * StampSeam riding the header's top border (each an `xs` horizontal `Stat`).
 * Entity-type-specific:
 *
 * - ABILITIES → ONE combined `[<tree> | <level>]` pill: the tree NAME is the
 *   (black) label cell, the level the value. Tree-only abilities show just the
 *   name; a level with no tree falls back to `[Level | <n>]`.
 * - TECH-LEVEL-ABLE entities (systems/modules/equipment/drones/vehicles — any
 *   entity carrying a `techLevel`) → `[Tech Level | <n>]`.
 * - Everything else → `[]` (just the TYPE stamp, no axis pills).
 *
 * Numeric vitals (SP/EP/Heat/Structure) stay in the header's top-right stat
 * cluster; only this classification axis lives in the seam.
 */
export function resolveAxisMarkers(entity: SURefMetaEntity): NEWAxisMarker[] {
  // Only ABILITY classification lives in the seam (Ability Tree · Level, folded
  // into ONE pill). TECH LEVEL moved to the header's top-right stat cluster.
  if (isAbility(entity)) {
    const tree = entity.tree != null ? String(entity.tree) : undefined
    const level = entity.level != null ? String(entity.level) : undefined
    if (tree) return [{ label: tree, value: level }]
    if (level) return [{ label: 'Level', value: level }]
    return []
  }
  return []
}

/**
 * Header stat-box label abbreviations (L1 mockup): the top-right stat cluster
 * uses short glyphs, not full names. Applied to a StatItem's `label`, with the
 * `bottomLabel` cleared so the box shows just the short label + value.
 */
/** Compact a header stat to its TOP label only — the whole first word (Structure
 * Points → Structure, Energy Points → Energy, Salvage Value → Salvage, System
 * Slots → System, Bio SV → Bio, …); the bottom label is dropped. */
export function abbreviateStat(stat: StatItem): StatItem {
  return stat.bottomLabel !== undefined ? { ...stat, bottomLabel: undefined } : stat
}
