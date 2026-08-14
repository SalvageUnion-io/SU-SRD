import type { SURefEnumSchemaName, SURefMetaEntity } from 'salvageunion-reference'
import {
  getDisplayName,
  getTechLevel,
  getTechLevelNumber,
  isAbility,
  SalvageUnionReference,
} from 'salvageunion-reference'
import type { CardSize } from '../../shared/displayMode'
import { TECH_LEVEL_BG } from '../../shared/techLevelStyles'
import { borderColorFromHeaderBg, calculateBackgroundColor } from '../referenceEntityHelpers'
/** The six card domains + `action`. Lives here, with the domain logic. */
export type CardDomain = 'pilot' | 'mech' | 'crawler' | 'actor' | 'gear' | 'glossary' | 'action'

/* The sizes a card renders at are NOT declared here. They live once, at the
 * Card layer (`shared/displayMode.ts`), and the entity card imports
 * `CardSize` directly — an alias here would just be the second name that let
 * `head` and `listing` drift apart in the first place. */

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
  const domainBySchema: Partial<Record<string, CardDomain>> = SCHEMA_DOMAIN
  return domainBySchema[schemaName]
}

export type DomainTone = {
  domain: CardDomain
  bg: string | undefined
  bgColor: string | undefined
}

/**
 * Which theme token each `guideTone` name resolves to.
 *
 * THIS is the mapping the dataset used to inline as raw hexes — one of them
 * byte-identical to `--color-mech`, two near-misses of `--color-pilot` and
 * `--color-crawler`. The dataset now names a tone (`GuideToneSchema` in
 * `salvageunion-reference`) and every colour resolves here, so a re-tone in
 * `theme.css` moves the guide bands with it.
 *
 * It lives in component-lib rather than the reference package because the
 * reference package must not know about CSS. Three names reuse the ontology
 * hues; `salvage` and `hazard` name tones for guides that are about none of the
 * five domains.
 */
const GUIDE_TONE_VAR = {
  pilot: 'var(--color-pilot)',
  mech: 'var(--color-mech)',
  crawler: 'var(--color-crawler)',
  salvage: 'var(--color-guide-salvage)',
  hazard: 'var(--color-guide-hazard)',
  ink: 'var(--color-ink)',
} as const satisfies Record<string, string>

/**
 * A guide's own authored tone as a CSS colour, or `undefined` for every other
 * entity.
 *
 * `GuideSchema` (`lib/schemas/entities.ts`) validates the name against a closed
 * enum and defaults it to `ink`, so a guide always has one; the narrowing here
 * is a runtime guard against malformed data rather than an expected `undefined`
 * branch. An unrecognised name falls through to the ordinary domain tone rather
 * than rendering a blank band.
 */
export function entityGuideToneColor(entity: SURefMetaEntity): string | undefined {
  if (entity == null || typeof entity !== 'object' || !('guideTone' in entity)) return undefined
  const tone = entity.guideTone
  if (typeof tone !== 'string') return undefined
  return GUIDE_TONE_VAR[tone as keyof typeof GUIDE_TONE_VAR]
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

  // GUIDES carry their OWN stored hue (`guideColor`), and it must win over the
  // glossary-ink domain default. The SRD index already paints each guide's
  // catalog tile with this exact hex (`catalogHelpers.ts` → `catalogBg`), so
  // resolving the card to `bg-ink-2` made every guide page a different colour
  // from the link that opened it — the one entity type whose tone is authored
  // per-item rather than derived from its domain.
  //
  // A DATA-SHAPE check, not a schema-name one (display-system rule): the hue
  // rides the stored field, so anything carrying a `guideColor` is toned by it.
  // Returned as `bgColor` (a raw CSS colour) rather than `bg` (a Tailwind
  // class) — the card threads `bgColor` to the header, sub-header, footer,
  // frame and nested children, and `accentSurface` applies it as an inline
  // background that wins over the class.
  const guideColor = entityGuideToneColor(entity)
  if (guideColor) {
    return { domain, bg: undefined, bgColor: guideColor }
  }

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
  // The warm cream the bands fade toward, and its ink-weighted counterpart for
  // the frame — both derived from tokens (band-cream / ink), not literals.
  const cream = 'var(--color-band-cream)'
  const creamFrame = 'color-mix(in srgb, var(--color-ink) 30%, var(--color-band-cream))'
  return {
    header: `color-mix(in srgb, ${hostBase} 32%, ${cream})`,
    sub: `color-mix(in srgb, ${hostBase} 46%, ${cream})`,
    frame: `color-mix(in srgb, ${hostBase} 55%, ${creamFrame})`,
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
 * DEPTH × SIZE → title type scale, resolving THE nested-title invariant: a card
 * at depth N+1 renders a strictly smaller title than its parent at depth N, for
 * as long as the ladder has room, and never a larger one once it bottoms out.
 *
 * Two axes drive one index into {@link TITLE_SIZE_LADDER}:
 *
 * - DEPTH is the primary step. Each nesting level moves ONE rung down the
 *   ladder — this is what makes a child strictly smaller than its parent.
 * - SIZE is an OFFSET, never a floor. `large` starts at rung 0 (the dominant
 *   name-tab), `medium` at rung 1, `small` at rung 2. It shifts the whole depth
 *   ramp down without flattening it. (It USED to be a `Math.max(depth, floor)`
 *   clamp, which collapsed depth 0 and depth 1 onto the same rung — a small
 *   depth-0 card and its depth-1 child both landed on rung 2, so the child was
 *   not smaller. An offset keeps consecutive depths one rung apart at every
 *   size.) The offsets are chosen so depth 0 reproduces the historical sizes
 *   exactly: large→`text-5xl`, medium→`text-xl`, small→`text-base`.
 *
 * THE FLOOR, honestly stated. The ladder bottoms out at `text-badge` (11px), the
 * legibility floor: below it a nested title stops being readable, so the type
 * cannot keep shrinking forever. Past the last rung the invariant weakens from
 * "strictly smaller than the parent" to "never LARGER than the parent" — two
 * cards nested past the floor share the floor rung. The ladder has six rungs, so
 * this only bites well beyond `MAX_DEPTH` (3): across every PRODUCED combination
 * — depths 0..3 (actions force a min depth of 1) at each size — every step is
 * still strictly smaller. Nested children are always spawned at `size='medium'`,
 * so a medium child at depth N+1 (rung N+2) is strictly smaller than any
 * large/medium parent at depth N, and never larger than a small parent (they
 * meet only at the shared floor).
 */
const TITLE_SIZE_LADDER = [
  'text-5xl',
  'text-xl',
  'text-base',
  'text-sm',
  'text-xs',
  'text-badge',
] as const

/** SIZE as a starting OFFSET into the ladder (not a floor) — see docblock. */
const SIZE_LADDER_OFFSET: Record<CardSize, number> = { large: 0, medium: 1, small: 2 }

export function titleSizeClass(depth: number, size: CardSize = 'large'): string {
  const rung = Math.max(depth, 0) + SIZE_LADDER_OFFSET[size]
  const index = Math.min(rung, TITLE_SIZE_LADDER.length - 1)
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

/**
 * The three kinds of pilot CLASS, as the stamp reads them.
 *
 * DERIVED, never stored. There is no `kind` field in `classes.json` and one must
 * not be added: the two flags below are already the authority, and a third
 * denormalised copy would be free to drift out of sync with them. This reads
 * those two explicit booleans — it is not a heuristic over unrelated stats
 * (contrast the `legalStarting` ruling, which forbade *computing* a badge from
 * tech level / SV; that inferred a fact the data never stated, this one does not).
 */
export type ClassKind = 'BASE' | 'HYBRID' | 'NON-ADVANCEABLE'

/**
 * Is this entity a pilot CLASS? A DATA-SHAPE check, per the display-system rule
 * that the card layer never branches on a schema-name string. `coreTrees` and
 * `hybrid` are top-level keys of `classes.json` and of nothing else.
 */
export function isClassEntity(entity: SURefMetaEntity): boolean {
  if (entity == null || typeof entity !== 'object') return false
  return 'coreTrees' in entity || 'hybrid' in entity
}

/**
 * Which KIND of class this is — the content of the class stampseal.
 *
 * ORDER IS LOAD-BEARING, and so is the `=== false`:
 * 1. `hybrid === true` → HYBRID (Fabricator, Cyborg, Union Rep, Smuggler, Ranger).
 * 2. `advanceable === false` → NON-ADVANCEABLE (the Salvager, and only it — its
 *    own rules text: "they cannot advance into any of the Hybrid Classes, nor do
 *    they have any Advanced or Legendary Abilities").
 * 3. otherwise → BASE (Engineer, Hacker, Hauler, Scout, Soldier).
 *
 * `advanceable` is `undefined` on every hybrid and a real boolean only on the
 * base classes, so this MUST test `=== false` rather than falsiness — a
 * `!advanceable` test would stamp all five hybrids NON-ADVANCEABLE.
 */
export function resolveClassKind(entity: SURefMetaEntity): ClassKind | undefined {
  if (!isClassEntity(entity)) return undefined
  if ('hybrid' in entity && entity.hybrid === true) return 'HYBRID'
  if ('advanceable' in entity && entity.advanceable === false) return 'NON-ADVANCEABLE'
  return 'BASE'
}

/**
 * The ability trees a HYBRID class requires, read from
 * `ability-tree-requirements.json` by the class's own NAME (a hybrid class and
 * its tree share a name). Base classes have no entry under their own name —
 * only their `Advanced X` / `Legendary X` trees do — so this naturally returns
 * `[]` for them and the requirements line renders for hybrids only. No
 * special-casing: absent entry ⇒ nothing rendered.
 */
export function resolveClassRequirements(entity: SURefMetaEntity): string[] {
  if (resolveClassKind(entity) !== 'HYBRID') return []
  const name = 'name' in entity && entity.name != null ? String(entity.name) : ''
  if (!name) return []
  const req = SalvageUnionReference.getByNameIn('ability-tree-requirements', name)
  const requirement = req?.requirement
  return Array.isArray(requirement) ? requirement.map(String) : []
}

/**
 * The requirements as the sub-header renders them: joined by **"or"**.
 *
 * The relation is a genuine DISJUNCTION — a pilot advances into a hybrid from
 * ONE of its two parent trees, not from both — so this is never a comma list
 * and never "and". The literal stored tree names are shown; mapping a tree back
 * to its owning class would be an inference the data does not make.
 */
export function formatClassRequirements(requirements: string[]): string | undefined {
  return requirements.length > 0 ? requirements.join(' or ') : undefined
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
 * - CLASSES → ONE `[Class | <KIND>]` pill naming which kind of class it is
 *   (BASE / HYBRID / NON-ADVANCEABLE), same `[label | value]` vocabulary as the
 *   pattern card's `[Chassis | Little Sestra]`.
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
    // The level pill is a numeric TIER within a tree. The Generic tree carries
    // `level: "G"` — a marker meaning "generic", not a rung — and feeding that
    // to a numeric readout rendered it as `0`, so a Generic card's seam read
    // "GENERIC 0" as though it sat below tier 1. A non-numeric level is dropped
    // and the tree name stands alone.
    const rawLevel = entity.level
    const level =
      rawLevel != null && Number.isFinite(Number(rawLevel)) ? String(rawLevel) : undefined
    if (tree) return [{ label: tree, value: level }]
    if (level) return [{ label: 'Level', value: level }]
    return []
  }
  // CLASS KIND — the one axis pill that survives `extent="catalog"`. Catalog
  // tiles otherwise suppress card chrome, but WHICH KIND of class a tile is
  // (base / hybrid / non-advanceable) is the single most load-bearing fact on a
  // class listing page: a hybrid can't be taken at creation and the Salvager
  // never advances, so a reader scanning the index needs it before they open
  // anything. This is a deliberate, ruled exception to the catalog suppression,
  // not an oversight — the seam is not gated on extent, so returning the marker
  // here is what carries it onto the tile. Keep it that way.
  const classKind = resolveClassKind(entity)
  if (classKind) return [{ label: 'Class', value: classKind }]
  return []
}
