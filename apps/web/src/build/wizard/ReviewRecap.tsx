/**
 * A wizard's Review recap, in the shared primitives (ruleset §3.7, EDL E3):
 * each `label | value` a horizontal Stat, the unit's class, chassis or type a
 * relation chip that opens and Peeks it (`Tag`), and every list of entities a
 * Slab over its Minis, one a line — never names joined with commas.
 */

import type { CSSProperties, ReactNode } from 'react'
import { useMemo } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import type { EntityFormModel } from '../../components/index'
import { Entity, relation, SlabSection, Stat, Tag, tokens } from '../../components/index'

/** The recap: its facts, then its lists, down one column. */
const RECAP = {
  alignItems: 'flex-start',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  minWidth: 0,
} satisfies CSSProperties

/** A list under its Slab, the full column wide. */
const SECTION = { alignSelf: 'stretch', marginTop: tokens.space[8] } satisfies CSSProperties

export function Recap({ children }: { children: ReactNode }) {
  return <div style={RECAP}>{children}</div>
}

/**
 * One fact. A required one left empty reads "Required", its frame the caution
 * state; an optional empty one is left out, as a read sheet leaves it.
 */
export function RecapStat({
  label,
  value,
  required = false,
}: {
  label: string
  value: string | number | null | undefined
  required?: boolean
}) {
  const empty = value === null || value === undefined || value === ''
  if (empty && !required) return null
  return (
    <Stat
      label={label}
      value={empty ? 'Required' : value}
      state={empty ? 'caution' : 'default'}
      wrap
    />
  )
}

/** What the unit is built as (`CLASS | Engineer`): opens and Peeks it. */
export function RecapEntity({
  label,
  entity,
  required = false,
}: {
  label: string
  entity: RefMetaEntity | undefined
  required?: boolean
}) {
  const entityRef = useMemo(() => (entity ? toEntityModel(entity).ref : undefined), [entity])
  if (!entityRef) return <RecapStat label={label} value={null} required={required} />
  return <Tag tag={relation(label, label, entityRef.name, { ref: entityRef })} linkable wrap />
}

/**
 * A list of entities under its Slab, as Minis one a line, each opening and
 * Peeking its entity; `empty` says what an empty list means ("None").
 */
export function RecapMinis({
  label,
  entities,
  models,
  empty = 'None',
}: {
  label: string
  /** Reference entities, each drawn from its own model. */
  entities?: readonly RefMetaEntity[]
  /** Or models resolved elsewhere (a player's crew NPCs). */
  models?: readonly EntityFormModel[]
  empty?: string
}) {
  const count = (entities?.length ?? 0) + (models?.length ?? 0)
  return (
    <SlabSection
      title={label}
      aria-label={label}
      count={count === 0 ? empty : undefined}
      style={SECTION}
    >
      {count > 0 && (
        <ul className="su-entity-mini-list">
          {entities?.map((entity, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a build may pick the same entity twice
            <li key={`${entity.id}-${index}`}>
              <Entity size="mini" context="loadout" entity={entity} mode={{ kind: 'link' }} />
            </li>
          ))}
          {models?.map((model, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two crew may share a name
            <li key={`${model.ref.id}-${index}`}>
              <Entity size="mini" context="roster" model={model} />
            </li>
          ))}
        </ul>
      )}
    </SlabSection>
  )
}
