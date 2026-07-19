import type { SURefEnumSchemaName, SURefMetaEntity } from 'salvageunion-reference'
import { getDisplayName, getTechLevel, getTechLevelNumber, isAbility } from 'salvageunion-reference'
import { TECH_LEVEL_BG } from '../../shared/techLevelStyles'
import { borderColorFromHeaderBg, calculateBackgroundColor } from '../referenceEntityHelpers'
/** The six card domains + `action`. Lives here, with the domain logic. */
export type CardDomain = 'pilot' | 'mech' | 'crawler' | 'actor' | 'gear' | 'glossary' | 'action'

/** The densities a `ReferenceEntityCard` renders at. Nested entities are ALWAYS
 * 'compact'; 'listing' uses the same compact header treatment, rendered as a
 * solid full-colour domain row; 'badge' is the SHORTFORM token — a single
 * tone-filled pill showing only the type stamp, name, and TL / Tree · Level.
 * 'catalog' is the SRD index tile: compact, artwork + description ONLY, with
 * every nested element (entities, actions, choices, patterns, roll tables)
 * suppressed so a listing page reads uniformly regardless of entity type. */
export type ReferenceEntityCardSize = 'full' | 'compact' | 'listing' | 'badge' | 'catalog'

/**
 * SCHEMA → DOMAIN — the single, exhaustive source of truth for which of the six
 * card domains a schema belongs to. Keyed off every schema in the reference enum,
 * so a new schema fails to COMPILE until it declares a domain: colour is an
 * OUTPUT of type, never inferred from a class string. Book-derived (Core Book
 * 2.0a): pilot = orange, mech (chassis) = green, crawler = pink, actor = rust,
 * gear = tech-level ramp, glossary = ink. `abilities` / `ability-tree-requirements`
 * are pilot-domain but resolve their ACCENT by tier (see `calculateBackgroundColor`),
 * so their tone comes from the tier hue, not the domain hue.
 */
const SCHEMA_DOMAIN: Record<SURefEnumSchemaName, CardDomain> = {
  abilities: 'pilot',
  'ability-tree-requirements': 'pilot',
  classes: 'pilot',
  chassis: 'mech',
  crawlers: 'crawler',
  'crawler-bays': 'crawler',
  'crawler-tech-levels': 'crawler',
  creatures: 'actor',
  'bio-titans': 'actor',
  npcs: 'actor',
  factions: 'actor',
  squads: 'actor',
  meld: 'actor',
  systems: 'gear',
  modules: 'gear',
  equipment: 'gear',
  drones: 'gear',
  vehicles: 'gear',
  distances: 'glossary',
  keywords: 'glossary',
  traits: 'glossary',
  guides: 'glossary',
  sources: 'glossary',
  'roll-tables': 'glossary',
  'tech-levels': 'glossary',
}

/**
 * The schema → domain lookup, for surfaces that need the GROUPING without the
 * card's tone resolution (e.g. the SRD catalog tiles, which paint their own
 * gradients per domain). Exported so that grouping lives in exactly one place:
 * a consumer keying off schema ids by hand drifts the moment a schema is added.
 */
export function resolveSchemaDomain(schemaName: string): CardDomain | undefined {
  return SCHEMA_DOMAIN[schemaName as SURefEnumSchemaName]
}

export type DomainTone = {
  domain: CardDomain
  bg: string | undefined
  bgColor: string | undefined
}

/**
 * The tone resolution: DOMAIN from the exhaustive map, ACCENT from the resolved
 * token. Gear rides the tech-level blue ramp; everything else takes its colour
 * from `calculateBackgroundColor` (the tier hue for abilities, the crawler
 * `headerColor` override, black-market ink, or the plain domain hue). The domain
 * is looked up, never parsed back out of the class string.
 */
export function resolveDomainTone(
  schemaName: SURefEnumSchemaName,
  entity: SURefMetaEntity
): DomainTone {
  const domain = SCHEMA_DOMAIN[schemaName]

  // GEAR → tech-level blue ramp (numeric tl-1..6, or the Bio / Nanite utility
  // class). Literal `bg-tl-*` strings so Tailwind actually emits the utility.
  if (domain === 'gear') {
    const techLevel = getTechLevel(entity)
    if (techLevel != null) {
      const bg =
        typeof techLevel === 'number'
          ? TECH_LEVEL_BG[techLevel]
          : techLevel === 'B'
            ? 'bg-tl-b'
            : 'bg-tl-n'
      return { domain, bg, bgColor: undefined }
    }
  }

  const bg = calculateBackgroundColor(
    schemaName,
    '',
    getTechLevelNumber(entity),
    entity,
    TECH_LEVEL_BG
  )
  return { domain, bg, bgColor: undefined }
}

/**
 * Ghosted action bands (D8): desaturate + lighten the HOST (summoning parent)
 * entity's tone toward a warm cream, so a nested action reads as a faded relative
 * of the entity that owns it — same colour family, clearly secondary. The light
 * band pairs with a contrast-aware (ink) compact title. The card and the
 * `ActionDirections` brainstorm share this ONE implementation. `hostBase` is the
 * parent's tone as a resolvable CSS colour (`var(--color-…)` / rgb()).
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
): DomainTone {
  if (schemaName === 'actions') {
    return { domain: 'action', bg: undefined, bgColor: undefined }
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

export type Eyebrow = { type: string }

/**
 * Eyebrow = the schema TYPE stamp only (e.g. "Ability", "System"). The
 * categorical classification axis (ability tree, tech level) no longer lives
 * in this Stamp — it rides the header's top-border seam instead, via
 * {@link resolveAxisMarker}.
 */
export function resolveEyebrow(schemaName: SURefEnumSchemaName | 'actions'): Eyebrow {
  if (schemaName === 'actions') return { type: 'Action' }
  // The crawler CLASS type reads "Crawler Type" (not just "Crawler").
  if (schemaName === 'crawlers') return { type: 'Crawler Type' }
  return { type: getDisplayName(schemaName) }
}

export type AxisMarker = { label: string; value?: string }

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
export function resolveAxisMarkers(entity: SURefMetaEntity): AxisMarker[] {
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
