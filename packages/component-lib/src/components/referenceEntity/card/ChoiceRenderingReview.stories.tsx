import type { Story } from '@ladle/react'
import { type ReactNode, useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { getChoices, SalvageUnionReference } from 'salvageunion-reference'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { Caption } from '../../../stories/_harness'
import { ReferenceEntityCard } from './ReferenceEntityCard'

/**
 * CHOICE RENDERING REVIEW — every entity the choice-plan changes affect, for a
 * side-by-side visual pass. Data-driven: the affected sets are computed from the
 * live dataset, so nothing is hand-listed and new affected entities appear
 * automatically.
 *
 *  · ChoiceEntities — Stage 7: choices render inline via source.kind (table →
 *    RollTable, text → field, options/catalog → cards). read-only vs editable.
 *  · CollapseEntities — Stage 6: the self-action folds regardless of action
 *    count; its siblings render as their own cards.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Choice Rendering Review',
}

const hasChoices = (e: SURefEntity): boolean => (getChoices(e) ?? []).length > 0

const isSelfActionMulti = (e: SURefEntity): boolean => {
  const actions = (e as { actions?: unknown }).actions
  const name = (e as { name?: unknown }).name
  return (
    Array.isArray(actions) &&
    actions.length > 1 &&
    typeof name === 'string' &&
    actions.includes(name)
  )
}

const nameOf = (e: SURefEntity): string => String((e as { name?: unknown }).name ?? '')
const idOf = (e: SURefEntity): string => String((e as { id?: unknown }).id ?? nameOf(e))

/** read-only vs editable, stacked, for one choice-bearing entity. */
function ChoiceCompare({ entity }: { entity: SURefEntity }): ReactNode {
  const [selections, setSelections] = useState<ChoiceSelections>({})
  return (
    <div className="flex flex-col gap-2 border-b border-ink/10 pb-6">
      <div className="font-cond text-sm font-bold uppercase tracking-caps-tight text-rust">
        {nameOf(entity)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Caption>read-only</Caption>
          <ReferenceEntityCard data={entity} />
        </div>
        <div className="flex flex-col gap-1">
          <Caption>editable</Caption>
          <ReferenceEntityCard
            data={entity}
            selections={selections}
            onSelectionChange={setSelections}
          />
        </div>
      </div>
    </div>
  )
}

/** Every entity that renders player choices (Stage 7), read-only vs editable. */
export const ChoiceEntities: Story = () => {
  const entities = [
    ...SalvageUnionReference.Equipment.all(),
    ...SalvageUnionReference.Drones.all(),
    ...SalvageUnionReference.CrawlerBays.all(),
  ].filter((e) => hasChoices(e as SURefEntity)) as SURefEntity[]
  return (
    <div className="flex flex-col gap-6 bg-paper p-4">
      <p className="max-w-prose font-body text-xs text-ink-2">
        {entities.length} choice-bearing entities. Stage 7 — choices render inline (no sub-header
        hoist); a table choice (A.I. Personality) shows its prose + an expandable RollTable, a text
        choice a field, options/catalog as cards. read-only shows every option solid; editable is
        choosable.
      </p>
      {entities.map((e) => (
        <ChoiceCompare key={idOf(e)} entity={e} />
      ))}
    </div>
  )
}

/** Every multi-action entity whose self-action now folds (Stage 6). */
export const CollapseEntities: Story = () => {
  const entities = [
    ...SalvageUnionReference.Systems.all(),
    ...SalvageUnionReference.Modules.all(),
    ...SalvageUnionReference.Abilities.all(),
    ...SalvageUnionReference.Equipment.all(),
  ].filter((e) => isSelfActionMulti(e as SURefEntity)) as SURefEntity[]
  return (
    <div className="flex flex-col gap-4 bg-paper p-4">
      <p className="max-w-prose font-body text-xs text-ink-2">
        {entities.length} multi-action entities carrying a same-named action. Stage 6 — the
        self-action now folds into the card body regardless of count; every other action (Patch,
        System Repair, Project…) renders as its own card below.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {entities.map((e) => (
          <div key={idOf(e)} className="flex flex-col gap-1">
            <Caption>{nameOf(e)}</Caption>
            <ReferenceEntityCard data={e} />
          </div>
        ))}
      </div>
    </div>
  )
}
