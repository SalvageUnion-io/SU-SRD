/**
 * The entity VIEW MODEL — what every form (Mention, Token, Row, Card, Page)
 * draws, resolved once by `toEntityModel`. The agreed language is
 * `docs/design-system/entity-display-language.md`.
 *
 * Serialisable on purpose: no functions, no React nodes, no CSS. A colour is a
 * theme TOKEN KEY (`mech`, `tl-3`) the UI maps to `--color-<key>`; a list
 * names its children by `EntityRef`, never by nesting their models.
 */

import type { EntitySchemaName } from '../generated/schemaRegistry.generated'
import type { SURefObjectContentBlock, SURefObjectTable } from '../schemas/index'
import type { TableRow } from '../utils/tableRows'

/** An entity as something a form can name and link. */
export type EntityRef = {
  schemaName: EntitySchemaName
  id: string
  slug: string
  name: string
  /** A chassis pattern: the pattern's name, under its chassis's identity. */
  pattern?: string
  /** Built from embedded data (a crawler's commander), not a dataset row:
   * never linked. */
  synthetic?: true
}

/** One label | value fact: a stat, a range, a damage, a requirement. */
/**
 * Which part of THE stat order a fact belongs to (`parts/facts.ts`): where
 * it comes from (TL, Slots, SV), what it can take (SP or HP, EP, Heat), what
 * it can hold (SYS, MODS, Cargo), what its action does (RNG, DMG, Uses). The
 * forms keep the groups in this order and set a wider gap between them.
 */
export type StatGroup = 'provenance' | 'vitals' | 'capacity' | 'action'

export type Fact = {
  key: string
  /** The full name, as a full-size value box prints it ("Structure Points"). */
  label: string
  /** The short form a compact cell prints ("SP"). */
  short: string
  value: string
  /** The value a compact cell prints, where it has a short form ("C/M" for "Close / Medium"). */
  shortValue?: string
  /** Its part of the stat order (`StatGroup`). */
  group?: StatGroup
  /** What the stat means, for its tooltip. */
  hint?: string
}

/** A named rule an entity carries: a trait, or a keyword-typed datavalue. */
export type TraitMention = {
  /** As printed: "Explosive". */
  name: string
  /** Its parameter: the 1 of "Explosive (1)". */
  param?: string
  /** The glossary it names an entry in. */
  schemaName: 'traits' | 'keywords'
  /** The entry, when the glossary carries one under that name. */
  ref?: EntityRef
}

/** The six card domains, plus `action`. */
export type EntityDomain = 'pilot' | 'mech' | 'crawler' | 'actor' | 'gear' | 'glossary' | 'action'

/** The three kinds of pilot class. */
export type ClassKind = 'BASE' | 'HYBRID' | 'NON-ADVANCEABLE'

/** The two kinds of crawler bay: on every Union Crawler, or added in play. */
export type BayKind = 'Standard' | 'Expansion'

/** A labelled group of nested entities ("Grants", "Systems"). */
export type EntityChildGroup = { key: string; label: string; items: EntityRef[] }

export type EntityTable =
  /** A one-roll table, as printable bands, highest roll first. */
  | { kind: 'bands'; name: string; rows: TableRow[] }
  /** A two-roll table: the raw buckets, since bands would misstate it. */
  | { kind: 'columns'; name: string; table: SURefObjectTable }

/** An entity's artwork, or none: an entity without art has no art place. */
export type EntityArt = { kind: 'image'; url: string } | { kind: 'none' }

export type EntityCite = {
  source?: string
  booklet?: string
  page?: number
  /** The book, then any reprints: "Workshop Manual · also in …". */
  citation?: string
  /**
   * The same printings one by one, the book first, then each reprint: a book
   * by its printed name (and booklet) and the page it is on. A page's foot
   * band draws each as its own cell.
   */
  printings: EntityPrinting[]
}

/** One printing of an entity: "Workshop Manual" on p.174. */
export type EntityPrinting = { book: string; page?: number }

/** A player's copy of an entity. No form draws one. */
export type EntityInstance = {
  condition?: 'intact' | 'damaged' | 'destroyed'
  uses?: number
  count?: number
  /** Replaces the entity's name as the title (a pilot's name for their mech). */
  title?: string
  notes?: string
  userMade?: boolean
}

export type EntityModel = {
  ref: EntityRef
  title: string
  kind: {
    /**
     * The kind in full: "System", "Ability · Hacking Tree", "Pattern". No form
     * stamps it (E9): the title carries it for screen readers only.
     */
    stamp: string
    /**
     * What a player unit is built as, shown where its kind is not: a pilot's
     * class, a mech's chassis ("Engineer", "Mule"). Never the kind itself.
     */
    note?: string
    /** The bare type: "Ability", "Crawler Type". */
    type: string
    domain: EntityDomain
    /** HAVE (wears its tone) or DO (an ability or action: the ink banner on a
     * Card or Page; an ability's Row wears its tier tone). */
    nature: 'have' | 'do'
    classKind?: ClassKind
  }
  /** The tone token key the UI maps to a colour (`--color-<tone>`). */
  tone: string
  /** What a derived entity is built on: a pattern's chassis. */
  parent?: { label: string; ref: EntityRef }
  /** An ability's tier numeral. */
  tier?: string
  techLevel?: number | 'B' | 'N'
  /** The cost pennant: "2 AP", "1 EP". */
  cost?: string
  /** The action type as data ("Turn", "Short", "Reaction"), for the head stamp. */
  actionType?: string
  /** The Mech half of a split action type; `actionType` is then the Pilot half. */
  mechActionType?: string
  /** Canonical order: Tech Level, the stats, then the action's and entity's
   * own facets (range, damage, population, requirement, datavalues). */
  facts: Fact[]
  /** The page's stat column, in the book's order and words. */
  bookStats: Fact[]
  traits: TraitMention[]
  /** Plain text: the entity's own opening prose. */
  lead?: string
  prose: SURefObjectContentBlock[]
  /** The self-action whose facets and cost are this entity's own. */
  folded?: EntityRef
  /** Every other visible action, as its own band. */
  actions: EntityRef[]
  /** A chassis's abilities (records in the actions schema). */
  abilities: EntityRef[]
  children: EntityChildGroup[]
  table?: EntityTable
  art: EntityArt
  cite: EntityCite
  userMade?: boolean
}
