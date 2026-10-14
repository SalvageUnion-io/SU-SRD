import type { ElementType } from 'react'
import { useMemo } from 'react'
import type { EntityInstance, SURefMetaEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import { Row } from './forms/Row'
import { Tile } from './forms/Tile'
import { Token } from './forms/Token'
import type { TagItem } from './parts/tagItems'
import { traitTags } from './parts/tagItems'
import type { EntityForm, EntityMode, EntityOmit, EntityRowModel } from './types'

type EntitySource =
  /** A reference record (or a chassis, with `pattern`): resolved to its model here. */
  | { entity: SURefMetaEntity; pattern?: SURefObjectAnyPattern; model?: never }
  /** A model resolved elsewhere (a build-time index, a list that resolved once). */
  | { model: EntityRowModel; entity?: never; pattern?: never }

export type EntityProps = EntitySource & {
  form: Extract<EntityForm, 'row' | 'token' | 'tile'>
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
  /** Row only: the title's element — a heading where the Row is a page's entry (default `span`). */
  titleAs?: ElementType
  /**
   * Row only: linked chips after its traits — the entities a player unit is
   * built on (`CLASS | Engineer`, `CHASSIS | Mule`), each a Tag that Peeks and
   * opens its entity where the Row is not itself a link.
   */
  links?: TagItem[]
}

/**
 * `<Entity>` — THE way to draw a game entity (entity display language): the
 * entity resolves once into its model (`toEntityModel`), the FORM picks which
 * parts to draw and the MODE fills the form's slots. It draws the Row, the
 * Token and the catalog's Tile; `<Mention>` draws a Mention, and
 * `ReferenceEntityCard` the Card and Page.
 */
export function Entity(props: EntityProps) {
  const { form, instance, mode, lead, omit, peek, priority, titleAs, links } = props
  const { entity, pattern } = props
  const ownModel = props.model
  const model = useMemo(
    () => ownModel ?? (entity ? toEntityModel(entity, instance, { pattern }) : undefined),
    [ownModel, entity, instance, pattern]
  )
  if (!model) return null
  switch (form) {
    case 'row':
      return (
        <Row
          model={model}
          instance={instance}
          mode={mode}
          lead={lead}
          omit={omit}
          peek={peek}
          slots={
            titleAs || links
              ? {
                  ...(titleAs ? { titleAs } : {}),
                  ...(links ? { tags: [...traitTags(model.traits), ...links] } : {}),
                }
              : undefined
          }
        />
      )
    case 'token':
      return <Token model={model} instance={instance} mode={mode} />
    case 'tile':
      return (
        <Tile
          model={model}
          mode={mode?.kind === 'link' || mode?.kind === 'read' ? mode : undefined}
          omit={omit}
          lead={lead}
          priority={priority}
        />
      )
    default: {
      const unknown: never = form
      throw new Error(
        `<Entity form="${String(unknown)}">: only "row", "token" and "tile" are drawn yet`
      )
    }
  }
}
