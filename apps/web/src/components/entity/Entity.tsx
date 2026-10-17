import type { ElementType, ReactNode } from 'react'
import { useMemo } from 'react'
import type {
  ChipContext,
  EntityInstance,
  RefMetaEntity,
  RefObjectAnyPattern,
} from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import { Row } from './forms/Row'
import { Tile } from './forms/Tile'
import type { TokenBody } from './forms/Token'
import { Token } from './forms/Token'
import type { TagItem } from './parts/tagItems'
import { traitTags } from './parts/tagItems'
import type { EntityMode, EntityOmit, EntityRowModel } from './types'

type EntitySource =
  /** A reference record (or a chassis, with `pattern`): resolved to its model here. */
  | { entity: RefMetaEntity; pattern?: RefObjectAnyPattern; model?: never }
  /** A model resolved elsewhere (a build-time index, a list that resolved once). */
  | { model: EntityRowModel; entity?: never; pattern?: never }

/**
 * The form, and the context its container names (C4): the one fact a Token's
 * lane carries, or the one measure a Row's head keeps (its kind's own when
 * unnamed). A Tile takes none.
 */
type EntityFormProps =
  | { form: 'token'; context: ChipContext }
  | { form: 'row'; context?: ChipContext }
  | { form: 'tile'; context?: never }

export type EntityProps = EntitySource &
  EntityFormProps & {
    /** A player's copy: its title, condition and whether it is user-made. */
    instance?: EntityInstance
    /** Default `read`; `link` on a surface that routes, `select` in a picker. */
    mode?: EntityMode
    /** Row and Tile: the opening prose, in browse contexts (E11). */
    lead?: boolean
    /** Facts the context already states, by key, `kind` under a slab that names it, or `tier`. */
    omit?: readonly EntityOmit[]
    /** Row only: hover, focus or a long press Peeks it (a Token always does). */
    peek?: boolean
    /** Tile only: its art loads at once and first (a listing's opening row). */
    priority?: boolean
    /** Tile only: the catalog has art; this art-less entity's place among its art-less ones (a censor mark). */
    missingArt?: number
    /**
     * Token only: the Peek address for a record with none of its own (a crawler
     * bay's crew NPC, through its bay: `embeddedPeekAddress`).
     */
    peekAt?: string
    /** Row only: the title's element — a heading where the Row is a page's entry (default `span`). */
    titleAs?: ElementType
    /**
     * Row only: the host's controls (Assign, Unassign, View), the head's
     * trailing mode slot (E7). They never nest in a link or select surface.
     */
    controls?: ReactNode
    /** Row only: the host's labels (an owner stamp), the first of its chips. */
    labels?: ReactNode
    /**
     * Row only: linked chips after its traits — the entities a player unit is
     * built on (`CLASS | Engineer`, `CHASSIS | Mule`), each a Tag that Peeks and
     * opens its entity where the Row is not itself a link.
     */
    links?: TagItem[]
    /**
     * Token and Row: the host's chip, last in its chip group — a damaged thing's
     * condition `StatusBadge` on a surface that only reads it (a crawler bay), a
     * listed unit's "⋯" menu.
     */
    trailing?: ReactNode
    /**
     * Token only: a CONTENTFUL Token (N3), its head then the entity's text and
     * the host's content (`TokenBody`); without it the Token is its head alone.
     */
    body?: TokenBody
  }

/**
 * `<Entity>` — THE way to draw a game entity (entity display language): the
 * entity resolves once into its model (`toEntityModel`), the FORM picks which
 * parts to draw and the MODE fills the form's slots. It draws the Row, the
 * Token and the catalog's Tile; `<Mention>` draws a Mention, and
 * `ReferenceEntityCard` the Card and Page.
 */
export function Entity(props: EntityProps) {
  const {
    instance,
    mode,
    lead,
    omit,
    peek,
    peekAt,
    priority,
    titleAs,
    missingArt,
    controls,
    labels,
    links,
    trailing,
    body,
  } = props
  const { entity, pattern } = props
  const ownModel = props.model
  const model = useMemo(
    () => ownModel ?? (entity ? toEntityModel(entity, instance, { pattern }) : undefined),
    [ownModel, entity, instance, pattern]
  )
  if (!model) return null
  switch (props.form) {
    case 'row':
      return (
        <Row
          model={model}
          {...(props.context ? { context: props.context } : {})}
          instance={instance}
          mode={mode}
          lead={lead}
          omit={omit}
          peek={peek}
          slots={
            titleAs || controls || labels || links || trailing
              ? {
                  ...(titleAs ? { titleAs } : {}),
                  ...(controls ? { controls } : {}),
                  ...(labels ? { extraLabels: labels } : {}),
                  ...(links ? { tags: [...traitTags(model.traits), ...links] } : {}),
                  ...(trailing ? { trailing } : {}),
                }
              : undefined
          }
        />
      )
    case 'token':
      return (
        <Token
          model={model}
          context={props.context}
          instance={instance}
          mode={mode}
          omit={omit}
          slots={
            trailing || peekAt
              ? { ...(trailing ? { trailing } : {}), ...(peekAt ? { peekAt } : {}) }
              : undefined
          }
          body={body}
        />
      )
    case 'tile':
      return (
        <Tile
          model={model}
          mode={mode?.kind === 'link' || mode?.kind === 'read' ? mode : undefined}
          omit={omit}
          lead={lead}
          priority={priority}
          missingArt={missingArt}
        />
      )
    default: {
      const unknown: never = props
      throw new Error(
        `<Entity form="${String((unknown as EntityProps).form)}">: only "row", "token" and "tile" are drawn yet`
      )
    }
  }
}
