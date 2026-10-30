import type { ElementType, ReactNode } from 'react'
import { useMemo } from 'react'
import type {
  ChipContext,
  EntityInstance,
  RefMetaEntity,
  RefObjectAnyPattern,
} from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import { Compact } from './forms/Compact'
import { CompactIndex } from './forms/CompactIndex'
import type { MiniBody } from './forms/Mini'
import { Mini } from './forms/Mini'
import type { LinkedUnit } from './LinkedUnits'
import { LinkedUnits } from './LinkedUnits'
import type { TagItem } from './parts/tagItems'
import { PeekSizeContext } from './peekContext'
import type { EntityFormModel, EntityMode, EntityOmit } from './types'

type EntitySource =
  /** A reference record (or a chassis, with `pattern`): resolved to its model here. */
  | { entity: RefMetaEntity; pattern?: RefObjectAnyPattern; model?: never }
  /** A model resolved elsewhere (a build-time index, a list that resolved once). */
  | { model: EntityFormModel; entity?: never; pattern?: never }

/**
 * The form, and the context its container names (C4): the one fact a Mini's
 * lane carries, or the one measure a Compact's head keeps (its kind's own when
 * unnamed). An index Compact takes none.
 */
type EntityFormProps =
  | { size: 'mini'; layout?: never; context: ChipContext; trailing?: never }
  | {
      size: 'compact'
      layout?: never
      context?: ChipContext
      /** The host's last chip, a listed unit's "⋯" menu (after `controls`). */
      trailing?: ReactNode
    }
  | { size: 'compact'; layout: 'index'; context?: never; trailing?: never }

export type EntityProps = EntitySource &
  EntityFormProps & {
    /** A player's copy: its title, condition and whether it is user-made. */
    instance?: EntityInstance
    /** Default `read`; `link` on a surface that routes, `select` in a picker. */
    mode?: EntityMode
    /** Compact and index Compact: the opening prose, in browse contexts (E11). */
    lead?: boolean
    /** Facts the context already states, by key, `kind` under a slab that names it, or `tier`. */
    omit?: readonly EntityOmit[]
    /** Compact only: hover, focus or a long press Peeks it (a Mini always does). */
    peek?: boolean
    /** Index Compact only: its art loads at once and first (a listing's opening row). */
    priority?: boolean
    /** Index Compact only: the catalog has art; this art-less entity's place among its art-less ones (a censor mark). */
    missingArt?: number
    /**
     * Mini only: the Peek address for a record with none of its own (a crawler
     * bay's crew NPC, through its bay: `embeddedPeekAddress`).
     */
    peekAt?: string
    /** Compact only: the title's element — a heading where the Compact is a page's entry (default `span`). */
    titleAs?: ElementType
    /**
     * Compact and Mini: the host's controls (Use, Assign, Unassign, View), the chip
     * group's last slot after the cost, ahead of a Compact's `trailing` "⋯" (C8,
     * hard rule R6).
     * They never nest in a link or select surface.
     */
    controls?: ReactNode
    /** Compact only: the host's labels (an owner stamp), the first of its chips. */
    labels?: ReactNode
    /**
     * Compact and Mini: what the unit is built on or linked to (`CLASS | Engineer`,
     * `CHASSIS | Mule`, `PILOT | Bonesaw`), the relation chips after its traits
     * (`chips-and-actions.md` C11). Each Peeks and opens its entity, or opens a
     * unit's sheet; a link Compact with them is covered, its link under them, and
     * a Mini with a linked one is its name's link.
     */
    relations?: TagItem[]
    /**
     * Compact and Mini: the units it is linked to (a pilot's mech), each a
     * header-only Mini leading its body (`LinkedUnits`), never a relation
     * chip. A Compact or Mini with them is contentful.
     */
    linked?: readonly LinkedUnit[]
    /**
     * Mini and Compact: the host's state chip after the cost (C8) — a live reading,
     * a damaged thing's condition on a surface that only reads it (a crawler bay).
     */
    state?: ReactNode
    /** Mini only: its band in this tone, dulled (`MiniSlots.tint`): a Play action's source unit. */
    tint?: string
    /** Mini: its `state` is a control (a condition that steps), so its name is the link (C8). */
    stateActs?: boolean
    /** Mini: the uses slot after its state (C8), a live item's stepper. */
    uses?: ReactNode
    /**
     * Mini only: a CONTENTFUL Mini (N3), its head then the entity's text and
     * the host's content (`MiniBody`); without it the Mini is its head alone.
     */
    body?: MiniBody
    /** Mini only: its host's one dim (`SELECT_DIM`), an unchosen toggle or a Play action not on hand. */
    dim?: boolean
    /** Mini only: read-only, a choice's picked option, ringed (R15). */
    chosen?: boolean
  }

/**
 * `<Entity>` — THE way to draw a game entity (entity display language): the
 * entity resolves once into its model (`toEntityModel`), the FORM picks which
 * parts to draw and the MODE fills the form's slots. It draws the Compact, the
 * Mini and the catalog's index Compact; `<Mention>` draws a Mention, and
 * `ReferenceEntityCard` the Card and Page.
 */
export function Entity(props: EntityProps) {
  const form = <EntityForm {...props} />
  // A Peek opened from a Compact or a Mini is a Mini (E23), its own included.
  return <PeekSizeContext.Provider value="mini">{form}</PeekSizeContext.Provider>
}

function EntityForm(props: EntityProps) {
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
    relations,
    linked,
    state,
    stateActs,
    tint,
    trailing,
    uses,
    body: ownBody,
    dim,
    chosen,
  } = props
  const { entity, pattern } = props
  const ownModel = props.model
  const model = useMemo(
    () => ownModel ?? (entity ? toEntityModel(entity, instance, { pattern }) : undefined),
    [ownModel, entity, instance, pattern]
  )
  if (!model) return null
  const linkedNode = linked?.length ? <LinkedUnits linked={linked} /> : undefined
  // A Mini's linked units lead its body, a header-only Mini's its whole body.
  const body: MiniBody | undefined = linkedNode
    ? {
        ...ownBody,
        text: ownBody?.text ?? false,
        children: (
          <>
            {linkedNode}
            {ownBody?.children}
          </>
        ),
      }
    : ownBody
  if (props.layout === 'index') {
    return (
      <CompactIndex
        model={model}
        mode={mode?.kind === 'link' || mode?.kind === 'read' ? mode : undefined}
        omit={omit}
        lead={lead}
        priority={priority}
        missingArt={missingArt}
      />
    )
  }
  switch (props.size) {
    case 'compact':
      return (
        <Compact
          model={model}
          {...(props.context ? { context: props.context } : {})}
          instance={instance}
          mode={mode}
          lead={lead}
          omit={omit}
          peek={peek}
          slots={
            titleAs || controls || labels || relations || trailing || state || linkedNode
              ? {
                  ...(titleAs ? { titleAs } : {}),
                  ...(linkedNode ? { linked: linkedNode } : {}),
                  ...(controls ? { controls } : {}),
                  ...(labels ? { extraLabels: labels } : {}),
                  ...(relations ? { relations } : {}),
                  ...(trailing ? { trailing } : {}),
                  ...(state ? { state } : {}),
                }
              : undefined
          }
        />
      )
    case 'mini':
      return (
        <Mini
          model={model}
          context={props.context}
          instance={instance}
          mode={mode}
          omit={omit}
          slots={
            state || peekAt || relations || tint || uses !== undefined || controls !== undefined
              ? {
                  ...(tint ? { tint } : {}),
                  ...(state ? { state } : {}),
                  ...(stateActs ? { stateActs } : {}),
                  ...(peekAt ? { peekAt } : {}),
                  ...(relations ? { relations } : {}),
                  // A Mini's controls are its chip group's last slots (C8).
                  ...(uses !== undefined ? { uses } : {}),
                  ...(controls !== undefined ? { menu: controls } : {}),
                }
              : undefined
          }
          body={body}
          dim={dim}
          chosen={chosen}
        />
      )
    default: {
      const unknown: never = props
      throw new Error(`unknown Entity size "${String((unknown as EntityProps).size)}"`)
    }
  }
}
