import type { EntityDomain, RefEnumSchemaName, RefMetaEntity } from 'salvageunion-reference'
import {
  bayKind,
  classKind,
  entityStamp,
  entityTone,
  guideTone,
  isAbility,
  isDoEntity as isDoRecord,
  schemaDomain,
  tierNumeral,
} from 'salvageunion-reference'
import { fontSize } from '../../../design/tokens'
import type { CardSize } from '../../containers/displayMode'
import type { HeaderFill } from './cardChrome'
/** The six card domains + `action` — the entity model's (`EntityDomain`). */
export type CardDomain = EntityDomain

/* The sizes a card renders at are NOT declared here. They live once, at the
 * Card layer (`containers/displayMode.ts`), and the entity card imports
 * `CardSize` directly — an alias here would just be the second name that let
 * `head` and `listing` drift apart in the first place. */

/**
 * The schema → domain lookup, for surfaces that need the GROUPING without the
 * card's tone resolution (e.g. the SRD catalog tiles). The map itself is the
 * entity model's (`schemaDomain`), exhaustive over the schema enum.
 */
export function resolveSchemaDomain(schemaName: string): CardDomain | undefined {
  return schemaDomain(schemaName)
}

export type DomainTone = {
  domain: CardDomain
  /** The domain tone as a CSS colour (`var(--color-mech)`). */
  bg: string | undefined
  /** A guide's tone (rules blue, every guide), which wins over `bg`. */
  bgColor: string | undefined
}

/**
 * A guide's tone as a CSS colour — rules blue for every guide, as its page's
 * band (the entity model's `guideTone`) — or `undefined` for every other
 * entity. The colour behind the token lives in `theme.css`.
 */
export function entityGuideToneColor(entity: RefMetaEntity): string | undefined {
  const token = guideTone(entity)
  return token ? `var(--color-${token})` : undefined
}

/**
 * The tone tokens the entity model paints with (`entityTone`). A token outside
 * this set paints no tone (the card falls back to paper).
 */
const TONE_TOKENS: ReadonlySet<string> = new Set([
  'mech',
  'crawler',
  'adversary',
  'pilot',
  'tier-hybrid',
  'heat',
  'ink-2',
  'wk-line',
  'tl-1',
  'tl-2',
  'tl-3',
  'tl-4',
  'tl-5',
  'tl-6',
  'tl-b',
  'tl-n',
])

/** A tone token as its CSS colour, or `undefined` outside `TONE_TOKENS`. */
function toneColor(token: string): string | undefined {
  return TONE_TOKENS.has(token) ? `var(--color-${token})` : undefined
}

/**
 * The tone resolution: DOMAIN from the exhaustive map, ACCENT from the entity
 * model's tone token (`entityTone`). A guide's tone (rules blue, every guide)
 * comes back as a raw colour (`bgColor`), which wins over the domain tone;
 * every other tone as `bg`, its token's colour.
 */
export function resolveDomainTone(
  schemaName: RefEnumSchemaName,
  entity: RefMetaEntity
): DomainTone {
  const domain = schemaDomain(schemaName) ?? 'glossary'
  const guideColor = entityGuideToneColor(entity)
  if (guideColor) return { domain, bg: undefined, bgColor: guideColor }
  return { domain, bg: toneColor(entityTone(schemaName, entity)), bgColor: undefined }
}

/**
 * The ONE tone resolver for the unified card. Entities resolve to their domain
 * hue / tech-level band. ACTIONS carry no tone of their own — an action is an
 * ink banner (see `isDoEntity`) — so this returns a neutral placeholder.
 */
export function resolveCardTone(
  schemaName: RefEnumSchemaName | 'actions',
  entity: RefMetaEntity
): DomainTone {
  if (schemaName === 'actions') {
    return { domain: 'action', bg: undefined, bgColor: undefined }
  }
  return resolveDomainTone(schemaName, entity)
}

/** HAVE vs DO (ruleset §5, board E1), by data shape — the entity model's. */
export function isDoEntity(entity: RefMetaEntity): boolean {
  return isDoRecord(entity)
}

/** The ability TIER NUMERAL the book prints at the left of an ability banner. */
export function resolveTierNumeral(entity: RefMetaEntity): string | undefined {
  return tierNumeral(entity)
}

/** The TYPE STAMP's wording ("Ability · Forging Tree"). */
export function resolveSeamLabel(
  schemaName: RefEnumSchemaName | 'actions',
  entity: RefMetaEntity
): string {
  return entityStamp(schemaName, entity)
}

/**
 * DEPTH × SIZE → title type scale (boards E1 and E2).
 *
 * The title is set by the card's SIZE — full 31px, compact 22px, mini 17px —
 * and nesting steps it down with the card: depth 1 renders compact (22px),
 * depth 2 is the one-line head row (17px), depth 3 one rung below that. So the
 * rung is the LATER of the size's own rung and the depth:
 *
 *   rung = max(SIZE offset, depth)
 *
 * The invariant this keeps: a nested title is NEVER LARGER than its parent's.
 * Under a full card it is strictly smaller at every level (31 → 22 → 17 → 15).
 * A compact card's depth-1 child is compact too and shares its rung — what tells
 * them apart there is containment, the frame (3 → 2 → 1.5px) and the level-2
 * Mini, not the type. Nested children are spawned at `compact`, or at `mini`
 * inside a mini card (`nestedChildSize`), so a child never outgrows its parent.
 *
 * THE FLOOR: the ladder bottoms out at `badge` (11px), the legibility floor
 * (ruleset §4.6); past it a title holds at the floor.
 *
 * The rungs are `fontSize` keys (`design/tokens.ts`).
 */
const TITLE_SIZE_LADDER = ['displayLg', 'title', 'readout', 'lede', 'caption', 'badge'] as const

/** A rung of the title ladder, as its `fontSize` token key. */
export type TitleRung = (typeof TITLE_SIZE_LADDER)[number]

/** SIZE as the ladder rung a depth-0 card starts on — see docblock. */
const SIZE_LADDER_OFFSET: Record<CardSize, number> = { full: 0, compact: 1, mini: 2 }

export function titleSizeRung(depth: number, size: CardSize = 'full'): TitleRung {
  const rung = Math.max(depth, 0, SIZE_LADDER_OFFSET[size])
  const index = Math.min(rung, TITLE_SIZE_LADDER.length - 1)
  return TITLE_SIZE_LADDER[index] ?? 'badge'
}

/**
 * The title's type step: by size, stepping down with depth (`titleSizeClass`). The ink
 * banner's large title sits a rung under the tone header's (board E1).
 */
export function resolveTitleSize(fill: HeaderFill, depth: number, size: CardSize) {
  const ladderTitle = titleSizeRung(depth, size)
  return fontSize[fill === 'ink' && ladderTitle === 'displayLg' ? 'display' : ladderTitle]
}

/**
 * The size a NESTED child renders at: compact — "nested is at least medium"
 * (board E2) — except inside a mini card, whose children stay mini so a
 * child never outgrows its parent.
 */
export function nestedChildSize(parentSize: CardSize): CardSize {
  return parentSize === 'mini' ? 'mini' : 'compact'
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
 * - CRAWLER BAYS → ONE `[Bay | Standard]` or `[Bay | Expansion]` pill, from
 *   the stored `expansion` tag.
 * - TECH-LEVEL-ABLE entities (systems/modules/equipment/drones/vehicles — any
 *   entity carrying a `techLevel`) → `[Tech Level | <n>]`.
 * - Everything else → `[]` (just the TYPE stamp, no axis pills).
 *
 * Numeric vitals (SP/EP/Heat/Structure) stay in the header's top-right stat
 * cluster; only this classification axis lives in the header labels.
 */
export function resolveAxisMarkers(entity: RefMetaEntity): AxisMarker[] {
  // An ABILITY carries no pill: its tree rides the type stamp and its
  // level is the banner's tier numeral (`resolveSeamLabel`,
  // `resolveTierNumeral`). TECH LEVEL is a header stat.
  if (isAbility(entity)) return []
  // CLASS KIND — an axis pill that survives `extent="catalog"`. Catalog
  // tiles otherwise suppress card chrome, but WHICH KIND of class a tile is
  // (base / hybrid / non-advanceable) is the single most load-bearing fact on a
  // class listing page: a hybrid can't be taken at creation and the Salvager
  // never advances, so a reader scanning the index needs it before they open
  // anything. This is a deliberate, ruled exception to the catalog suppression,
  // not an oversight — the labels are not gated on extent, so returning the marker
  // here is what carries it onto the tile. Keep it that way.
  const kind = classKind(entity)
  if (kind) return [{ label: 'Class', value: kind }]
  // BAY KIND survives the catalog for the same reason: whether a bay comes
  // with every Union Crawler or is added in play is what the bay index is
  // scanned for.
  const bay = bayKind(entity)
  if (bay) return [{ label: 'Bay', value: bay }]
  return []
}
