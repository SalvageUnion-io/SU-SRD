/**
 * CrewLeadToken — a crawler bay's crew lead, inside its bay card: a
 * CONTENTFUL Token (N3). The bay is a level-1 entity, so its crew lead sits at
 * level 2 and is a Token (N1), never a titled box (N5).
 *
 * The head is the NPC's: its name (the role it holds stamped before it once it
 * has a name of its own, as a player unit's note is) and its HP, live in Read
 * (`HP | 3/4`); it Peeks the bay's crew NPC, or opens a built NPC's sheet. The
 * body is what the sheet tracks about them: Keepsake, Motto, Detail and Facts
 * (`NpcLines`), each left out in Read when empty. In Edit the body holds their
 * fields, led by the name and HP, which a head that is a Peek trigger cannot
 * hold; the head then drops its HP chip, the stepper's reading being the one.
 *
 * Handler absence is the read-only encoding, as on `NpcInset`.
 */

import { useMemo } from 'react'
import type { EntityInstance, RefMetaEntity } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import type { EntityMode, EntityRowModel } from '../../components/index'
import { Entity } from '../../components/index'
import type { NpcInsetProps } from './NpcInset'
import { NpcLines } from './NpcInset'

type CrewLeadTokenProps = NpcInsetProps & {
  /** Its title on the head (the bay crew's name, else its role); a built NPC's model titles itself. */
  instance?: EntityInstance
  /** Default `read`; a built NPC's head links to its sheet. */
  mode?: EntityMode
  /** The head's Peek address for an NPC with none of its own (`embeddedPeekAddress`). */
  peekAt?: string
} & CrewSource

/** Who heads it: the bay's SRD crew NPC, or a crew lead no reference record describes (`unitRowModel`). */
type CrewSource =
  | { entity: RefMetaEntity; model?: never }
  | { model: EntityRowModel; entity?: never }

/** The head's chips: HP read live, or left to the body's stepper while it writes. */
function crewHead(
  model: EntityRowModel,
  {
    title,
    name,
    hp,
    maxHp,
    editing,
  }: { title?: string; name: string; hp: number; maxHp: number; editing: boolean }
): EntityRowModel {
  const facts = model.facts.filter((fact) => fact.short !== 'HP')
  const book = model.facts.find((fact) => fact.short === 'HP')
  if (!editing && maxHp > 0) {
    facts.unshift({
      key: book?.key ?? 'crew-hp',
      label: book?.label ?? 'Hit Points',
      short: 'HP',
      value: `${hp}/${maxHp}`,
      group: 'vitals',
      ...(book?.hint ? { hint: book.hint } : {}),
    })
  }
  const named = name.trim() !== '' && name.trim() !== title
  return {
    ...model,
    facts,
    ...(title && named ? { kind: { ...model.kind, note: title } } : {}),
  }
}

export function CrewLeadToken(props: CrewLeadTokenProps) {
  const { bayName, title, name, hp, maxHp, onHpChange, instance, mode, peekAt, entity } = props
  const own = props.model
  const base = useMemo(() => own ?? toEntityModel(entity as RefMetaEntity), [own, entity])
  const editing = onHpChange !== undefined
  const model = useMemo(
    () => crewHead(base, { title, name, hp, maxHp, editing }),
    [base, title, name, hp, maxHp, editing]
  )
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labeled group (not a landmark) names the crew lead so the several on one crawler stay distinguishable; a <section> here would become a region landmark once named
    <div role="group" aria-label={`${bayName} crew lead`}>
      <Entity
        form="token"
        context="roster"
        model={model}
        instance={instance}
        mode={mode}
        peekAt={peekAt}
        body={{ text: false, children: <NpcLines {...props} identity /> }}
      />
    </div>
  )
}
