import { useMemo } from 'react'
import type { EntityInstance, SURefMetaEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import { Row } from './forms/Row'
import type { TokenFact } from './forms/Token'
import { Token } from './forms/Token'
import type { EntityForm, EntityMode, EntityOmit, EntityRowModel } from './types'

type EntitySource =
  /** A reference record (or a chassis, with `pattern`): resolved to its model here. */
  | { entity: SURefMetaEntity; pattern?: SURefObjectAnyPattern; model?: never }
  /** A model resolved elsewhere (a build-time index, a list that resolved once). */
  | { model: EntityRowModel; entity?: never; pattern?: never }

export type EntityProps = EntitySource & {
  form: Extract<EntityForm, 'row' | 'token'>
  /** A player's copy: its title, condition and whether it is user-made. */
  instance?: EntityInstance
  /** Default `read`; `link` on a surface that routes, `select` in a picker. */
  mode?: EntityMode
  /** Row only: the opening prose, in browse contexts (E11). */
  lead?: boolean
  /** Facts the context already states, by key, or `kind` under a slab that names it. */
  omit?: readonly EntityOmit[]
  /** Token only: the fact the context counts, in place of its default. */
  fact?: TokenFact | null
  /** Row only: hover, focus or a long press Peeks it (a Token always does). */
  peek?: boolean
}

/**
 * `<Entity>` — THE way to draw a game entity (entity display language): the
 * entity resolves once into its model (`toEntityModel`), the FORM picks which
 * parts to draw and the MODE fills the form's slots. Phase 2 draws the Row
 * and the Token; Mention, Card and Page follow, and until then
 * `ReferenceEntityCard` draws those.
 */
export function Entity(props: EntityProps) {
  const { form, instance, mode, lead, omit, fact, peek } = props
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
        <Row model={model} instance={instance} mode={mode} lead={lead} omit={omit} peek={peek} />
      )
    case 'token':
      return <Token model={model} instance={instance} mode={mode} fact={fact} />
    default: {
      const unknown: never = form
      throw new Error(`<Entity form="${String(unknown)}">: only "row" and "token" are drawn yet`)
    }
  }
}
