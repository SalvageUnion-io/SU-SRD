/**
 * A wizard's Review recap, in the shared primitives (ruleset §3.7, EDL E3):
 * each `label | value` a horizontal Stat, the unit's class, chassis or type a
 * chip that opens and Peeks it (`EntityStat`), and every list of entities a
 * Slab over its Tokens, one a line — never names joined with commas.
 */

import type { EntityRowModel } from 'component-lib'
import { Entity, EntityStat, Slab, Stat, tokens } from 'component-lib'
import type { CSSProperties, ReactNode } from 'react'
import { useMemo } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'

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

const SLAB = { marginBottom: tokens.space[6] } satisfies CSSProperties

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
      orientation="horizontal"
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
  return <EntityStat label={label} entityRef={entityRef} />
}

/**
 * A list of entities under its Slab, as Tokens one a line, each opening and
 * Peeking its entity; `empty` says what an empty list means ("None").
 */
export function RecapTokens({
  label,
  entities,
  models,
  empty = 'None',
}: {
  label: string
  /** Reference entities, each drawn from its own model. */
  entities?: readonly RefMetaEntity[]
  /** Or models resolved elsewhere (a player's crew NPCs). */
  models?: readonly EntityRowModel[]
  empty?: string
}) {
  const count = (entities?.length ?? 0) + (models?.length ?? 0)
  return (
    <section aria-label={label} style={SECTION}>
      <Slab label={label} count={count === 0 ? empty : undefined} style={SLAB} />
      {count > 0 && (
        <ul className="su-entity-token-list">
          {entities?.map((entity, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a build may pick the same entity twice
            <li key={`${entity.id}-${index}`}>
              <Entity form="token" entity={entity} mode={{ kind: 'link' }} />
            </li>
          ))}
          {models?.map((model, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two crew may share a name
            <li key={`${model.ref.id}-${index}`}>
              <Entity form="token" model={model} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
