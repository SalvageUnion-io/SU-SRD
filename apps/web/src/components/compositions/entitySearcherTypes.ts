/** The shapes `EntitySearcher` and its parts share. */

import type { ReactNode } from 'react'
import type { EntitySchemaName, SchemaToEntityMap } from 'salvageunion-reference'
import type { ReferenceEntityCardHideConfig } from '../referenceEntity/card/referenceEntityCardTypes'

/** A tech level as the reference data carries it — schema-typed `number`, not
 * the rules module's 1–6 literal union, so ORM entities assign structurally. */
export type TechLevelLike = number | 'B' | 'N'

/** The minimum shape the searcher reads off a reference entity. */
export type EntityLike = {
  id: string
  name: string
  techLevel?: TechLevelLike
  traits?: Array<{ type: string; amount?: string | number }>
}

/** A pool row: the structural `EntityLike` view the searcher reads, WITHOUT
 * losing the reference-entity identity `ReferenceEntityCard` renders. */
export type PoolEntity = EntityLike & SchemaToEntityMap[EntitySchemaName]

/** Which built-in facets to show, plus an optional schema-specific category. */
export type FacetConfig = {
  /** Tech-level swatch chips. Default: auto (shown when the pool spans ≥2 TLs). */
  techLevel?: boolean
  /** All / Equipped only / Not yet equipped. Default: true. */
  status?: boolean
  /** Trait-type chips. Default: auto (shown when the pool has ≥2 trait types). */
  traits?: boolean
  /** A schema-specific categorical facet (e.g. ability `tree`, NPC `damageType`). */
  category?: { label: string; of: (item: EntityLike) => string | undefined }
}

export type BudgetConfig = {
  label: string
  used: number
  /** The budget's cap; a running total with no cap (a build's Scrap cost) has none. */
  max?: number | undefined
}

/** What adding an entry costs, and the act that adds it and pays (`EntitySearcher`'s `cost`). */
export type PickCost = {
  /** The cost and what is left to pay it: "Costs 1 TP · 0 left". */
  label: string
  /** The paying act: "Spend 1 TP and add". */
  payLabel: string
  /** There is enough to pay it. */
  canPay: boolean
  onPay: () => void
  /**
   * What the book asks first that this pick has not met ("level 1 of that
   * tree hasn't been taken"): said on the action bar, never a gate.
   */
  unmet?: readonly string[]
  /**
   * The plain add would break a rule (out of order, or too few points to
   * pay): its button says so before the press (r4 E12).
   */
  breaks?: boolean
  /** The cost on the entry's line in the list: `TP | 1` (r4 E12). */
  row?: { label: string; value: number | string }
}

/** One facet row: its label and its chips, a Field over its Segmented. */
export type FacetRowConfig = {
  label: string
  chips: Array<{
    key: string
    label: string
    active: boolean
    onClick: () => void
    swatchStyle?: string
  }>
}

/** `EntitySearcher`'s props. */
export type EntitySearcherProps = {
  /** Which reference collection to search. */
  schema: EntitySchemaName
  /** Refs currently on the sheet (may contain duplicates in `count` mode). */
  selected: string[]
  /**
   * `toggle` (default): one copy per entity — the focused Page's ADD adds it,
   * its ✕ in the rail removes it.
   * `count`: duplicates are legal — ADD ANOTHER appends a copy, and each copy
   * has its own ✕ in the rail.
   * `single`: exactly one — the focused Page's CHOOSE picks it, and that
   * press is the choice: the caller applies `onToggle`'s ref and closes. It is
   * only ever emitted for an entity that is not the one chosen, and Enter in
   * the search opens the first match to read instead of choosing it.
   * `browse`: nothing is chosen — a reference browser, not a picker (the
   * Play's SRD Explorer). No rail, no Status facet; a Mini's
   * click emits `onOpen`.
   */
  mode?: 'toggle' | 'count' | 'single' | 'browse'
  /** toggle/single mode: add or remove (emits `idOf(item)` either way). */
  onToggle?: (ref: string) => void
  /** browse mode: open an entity (emits `idOf(item)`). */
  onOpen?: (ref: string) => void
  /** count mode: append one copy (emits `idOf(item)`). */
  onAdd?: (ref: string) => void
  /** count mode: remove the chosen entry at `index` in `selected`. */
  onRemove?: (index: number) => void
  /** An entity's identity in `selected`, and what adding it emits. Default: the entity name. */
  idOf?: (item: EntityLike) => string
  /** Narrow the pool (e.g. only weapons). Default: the whole collection. */
  filter?: (item: EntityLike) => boolean
  facets?: FacetConfig
  /**
   * The Tech Level of what the picks land on (a mech's): the picker opens on
   * that level and under, "Show all Tech Levels" widens it, and an entry above
   * it is tagged. Never blocks a pick (Free Edit).
   */
  techLevel?: number
  /**
   * What adding an entry costs, where the sheet can pay it as it adds (an
   * ability's Training Points): the focused Page's action bar says the cost
   * and offers to pay it, beside the plain add. Never blocks the add.
   */
  cost?: (item: EntityLike) => PickCost | undefined
  /** Optional soft budget(s) shown in the rail (never blocks selection). */
  budget?: BudgetConfig | BudgetConfig[]
  /** Who the picks land on, e.g. the pilot or mech name: the rail heading and
   * the ADD TO … button. */
  railName?: string
  /** Rail header noun for the chosen list, e.g. 'Equipped', 'Installed'. */
  chosenLabel?: string
  /** Copy shown when nothing matches the filters. */
  emptyMessage?: string
  /** The title rendered in the searcher's Card header. */
  title?: string
  /** A caveat stamped under the title, e.g. a destructive-change warning. The
   * searcher is usually launched in a `bare` ModalShell, which paints no header
   * of its own, so this is where a picker's warning copy lives. */
  subtitle?: string
  /** Close handler — renders the header's close badge, and DONE in the rail
   * of a toggle or count picker. */
  onClose?: () => void
  /**
   * Extra `hide` config for the focused Page, merged OVER the searcher's
   * own defaults (choices are always suppressed, actions unless
   * `actions: false` asks for them). Big entities — a
   * chassis, a crawler type — carry sections a picker has no room for
   * (`{ patterns: true }`), and that is a property of the entity, not of the
   * surface, so it is the caller's call rather than a schema check in here.
   */
  hide?: ReferenceEntityCardHideConfig
  /** The mech builder's chassis picker: the focused Page shows its chassis
   * ability despite the forced `hide.actions` (E19). */
  showChassisAbility?: boolean
  /**
   * Actions pinned beneath the selection — e.g. a single picker's Cancel. Always visible: at the foot of the rail column,
   * or in the bottom bar on a narrow screen. Replaces DONE.
   */
  railActions?: ReactNode
  /** The caller's own entities, searched instead of the `schema` collection
   * (a Mediator's designed NPCs, shaped as `npcs` entities). */
  entities?: readonly PoolEntity[]
  /** Above the toolbar: what the picker draws from (the Opposition's kinds). */
  lead?: ReactNode
  /** The query the search field opens with, and a report of each change, so a
   * host that swaps collections keeps one search across them. */
  initialQuery?: string
  onQueryChange?: (query: string) => void
  /** A choice that goes with adding the focused entity, beside its ADD. */
  focusExtra?: (entity: EntityLike) => ReactNode
  /** The chosen list already resolved, shown in the rail instead of
   * `selected` (which still drives the list's seals and counts). */
  railEntities?: readonly PoolEntity[]
  /** The entities are the player's own (`entities`): the Page credits no book. */
  userMade?: boolean
  /**
   * The host draws the frame (the SRD Explorer's dialog head): the searcher
   * hands it its toolbar, for the host's band, and its body, for under it,
   * and draws no cut-out box of its own, so there is never a titled box in a
   * titled box. `title`, `subtitle` and the close badge are then the host's
   * to show. Without it the searcher is its own frame, as every picker in a
   * `bare` ModalShell needs.
   */
  frame?: (parts: { toolbar: ReactNode; body: ReactNode }) => ReactNode
}
