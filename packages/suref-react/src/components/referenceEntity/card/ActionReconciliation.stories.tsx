import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import type { SURefEntity, SURefEnumSchemaName, SURefMetaEntity } from 'salvageunion-reference'
import {
  SalvageUnionReference,
  extractVisibleActions,
  getChassisAbilities,
} from 'salvageunion-reference'
import { ActionCard } from '../ActionCard'
import { NestedChassisAbility } from '../NestedChassisAbility'
import { borderColorFromHeaderBg } from '../referenceEntityHelpers'
import { ReferenceEntityCard } from './ReferenceEntityCard'
import { resolveCardTone } from './entityCardTone'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Reference Entity Action Reconciliation',
}

/**
 * QA COMPARISON for retiring the legacy ActionCard + NestedChassisAbility onto the
 * canonical card's action mode. Each row shows the LEGACY component (left) beside
 * the canonical `ReferenceEntityCard` rendering the same action/ability with the
 * parent's ghosted host tone (right). Sign-off gate before migrating the ITUN
 * consumers (ActionsDeck / ActionCardErow / MechStatsStep) and deleting the legacy.
 */

function pick<T>(list: T[], predicate: (item: T) => boolean, label: string): T {
  const found = list.find(predicate) ?? list[0]
  if (!found) throw new Error(`Action reconciliation story: no ${label} loaded`)
  return found
}

/** The parent's tone base — exactly what the card threads to an action as `hostTone`. */
function parentToneBase(parent: SURefEntity): string {
  const schemaName = (parent as { schemaName?: string }).schemaName as
    | SURefEnumSchemaName
    | 'actions'
  const tone = resolveCardTone(schemaName, parent as SURefMetaEntity)
  return borderColorFromHeaderBg(tone.bg, tone.bgColor) ?? 'var(--color-su-black)'
}

const chassis = pick(
  SalvageUnionReference.Chassis.all(),
  (c) => c.name === 'Little Sestra',
  'chassis'
)
const chassisTone = parentToneBase(chassis as unknown as SURefEntity)
const chassisAbility = pick(getChassisAbilities(chassis) ?? [], () => true, 'chassis ability')

function pickAction(parent: SURefEntity) {
  return pick(
    extractVisibleActions(parent as unknown as SURefMetaEntity) ?? [],
    () => true,
    'action'
  )
}

const system = pick(
  SalvageUnionReference.Systems.all(),
  (s) => (extractVisibleActions(s as unknown as SURefMetaEntity) ?? []).length > 0,
  'system with an action'
)
const systemTone = parentToneBase(system as unknown as SURefEntity)
const systemAction = pickAction(system as unknown as SURefEntity)

// A bio-titan reliably carries visible actions — the second action example.
const titan = pick(
  SalvageUnionReference.BioTitans.all(),
  (b) => (extractVisibleActions(b as unknown as SURefMetaEntity) ?? []).length > 0,
  'bio-titan with an action'
)
const titanTone = parentToneBase(titan as unknown as SURefEntity)
const titanAction = pickAction(titan as unknown as SURefEntity)

function Pair({
  label,
  legacy,
  canonical,
}: {
  label: string
  legacy: ReactNode
  canonical: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <code className="font-mono text-nano text-ink-2">{label}</code>
      <div className="flex flex-col gap-4">
        <div className="flex w-[420px] flex-col gap-1.5">
          <code className="font-mono text-nano text-ink-2">LEGACY</code>
          {legacy}
        </div>
        <div className="flex w-[420px] flex-col gap-1.5">
          <code className="font-mono text-nano text-ink-2">canonical card (action mode)</code>
          {canonical}
        </div>
      </div>
    </div>
  )
}

/** Legacy ActionCard vs the canonical card rendering the same action (ghosted host tone). */
export const ActionCards: Story = () => (
  <div className="flex flex-col gap-8 bg-paper p-5">
    <Pair
      label={`system action · ${system.name} → ${systemAction.name}`}
      legacy={<ActionCard data={systemAction} parentHeaderBgColor={systemTone} />}
      canonical={
        <ReferenceEntityCard data={systemAction as unknown as SURefEntity} hostTone={systemTone} />
      }
    />
    <Pair
      label={`bio-titan action · ${titan.name} → ${titanAction.name}`}
      legacy={<ActionCard data={titanAction} parentHeaderBgColor={titanTone} />}
      canonical={
        <ReferenceEntityCard data={titanAction as unknown as SURefEntity} hostTone={titanTone} />
      }
    />
  </div>
)

/** Legacy NestedChassisAbility vs the canonical card rendering the same ability. */
export const ChassisAbilities: Story = () => (
  <div className="flex flex-col gap-8 bg-paper p-5">
    <Pair
      label={`chassis ability · ${chassis.name} → ${chassisAbility.name}`}
      legacy={<NestedChassisAbility data={chassisAbility} chassisName={chassis.name} />}
      canonical={
        <ReferenceEntityCard
          data={chassisAbility as unknown as SURefEntity}
          hostTone={chassisTone}
          chassisName={chassis.name}
        />
      }
    />
  </div>
)
