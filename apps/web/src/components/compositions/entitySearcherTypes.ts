/** The shapes `EntitySearcher` and its parts share. */

import type { EntitySchemaName, SchemaToEntityMap } from 'salvageunion-reference'

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
  max: number
}

/** One facet row: its label and its chips, rendered through the shared FilterRow. */
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
