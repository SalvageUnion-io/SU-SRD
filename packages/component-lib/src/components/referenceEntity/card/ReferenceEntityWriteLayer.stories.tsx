import type { Story } from '@ladle/react'
import { type ReactNode, useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { EntityStatus } from '../../shared/entityStatus'
import type { StatItem } from '../../shared/statsBarTypes'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { selectControl } from '../ReferenceEntityDisplay/referenceEntityControls'
import { ReferenceEntityCard } from './ReferenceEntityCard'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Reference Entity Write Layer',
}

/**
 * Real SRD entity lookup with a first-entry fallback (data drift safety) —
 * throws instead of silently rendering `undefined` if a schema is ever empty.
 */
function pick<T>(list: T[], predicate: (item: T) => boolean, schemaName: string): T {
  const found = list.find(predicate) ?? list[0]
  if (!found) throw new Error(`NEW/Write Layer story: no ${schemaName} entities loaded`)
  return found
}

// Real SRD subjects for the write-layer demos.
const chassis = pick(
  SalvageUnionReference.Chassis.all(),
  (c) => c.name === 'Little Sestra',
  'chassis'
)
const system = pick(
  SalvageUnionReference.Systems.all(),
  (s) => s.name === 'Salvaging Drill',
  'system'
)
const choiceEquip = pick(
  SalvageUnionReference.Equipment.all(),
  (e) => e.name === 'Custom Sniper Rifle',
  'choice equipment'
)
// Auto-Turret carries BOTH a freeform choice (Name) and a table choice (A.I.
// Personality, a rollTable) — both now render INLINE in the body (Stage 7).
const freeformEquip = pick(
  SalvageUnionReference.Equipment.all(),
  (e) => e.name === 'Auto-Turret',
  'freeform choice equipment'
)

/**
 * Stacked comparison harness: the canonical card read-only (top — the baseline)
 * and the same card with the write layer engaged (bottom). Each block is
 * captioned so the diff is obvious at a glance.
 */
function TwoUp({ readOnly, editable }: { readOnly: ReactNode; editable: ReactNode }): ReactNode {
  return (
    <div className="flex flex-col gap-6 bg-paper p-4">
      <div className="flex flex-col gap-1.5">
        <code className="font-mono text-nano text-ink-2">read-only</code>
        {readOnly}
      </div>
      <div className="flex flex-col gap-1.5">
        <code className="font-mono text-nano text-ink-2">editable</code>
        {editable}
      </div>
    </div>
  )
}

/**
 * A SELECTABLE wizard chassis: the poster double-halo + a `Select` control +
 * whole-card click. Legacy uses `selectControl`; the NEW editable column adds
 * the halo (box-shadow, non-layout-shifting) and card-click affordance.
 */
export const SelectableChassis: Story = () => {
  const [selected, setSelected] = useState(false)
  const toggle = () => setSelected((s) => !s)
  return (
    <TwoUp
      readOnly={<ReferenceEntityCard data={chassis} />}
      editable={
        <ReferenceEntityCard
          data={chassis}
          selected={selected}
          onCardClick={toggle}
          controls={[selectControl(toggle, selected)]}
        />
      }
    />
  )
}

/**
 * A SHEET ITEM with a status cycle: the Intact → Damaged → Destroyed chip in the
 * header stat axis. Damaged/Destroyed greys the whole tone; Destroyed also drops
 * the red danger scrim over the body.
 */
export const StatusCycleItem: Story = () => {
  const [status, setStatus] = useState<EntityStatus>('intact')
  const cycle = () =>
    setStatus((s) => (s === 'intact' ? 'damaged' : s === 'damaged' ? 'destroyed' : 'intact'))
  const isDown = status === 'damaged' || status === 'destroyed'
  return (
    <TwoUp
      readOnly={<ReferenceEntityCard data={system} />}
      editable={
        <ReferenceEntityCard
          data={system}
          status={status}
          onStatusClick={cycle}
          damaged={isDown}
          damageOverlayText={status === 'destroyed' ? 'Destroyed' : undefined}
        />
      }
    />
  )
}

/**
 * EDITABLE SP/EP steppers: a live mech sheet card. The header stat axis carries
 * SP + EP `StatItem`s with `onChange`, which render the `Stat` edit-mode
 * +/- stepper column. Legacy has no multi-stat editable path, so its column is
 * the plain reference card.
 */
export const EditableStats: Story = () => {
  const [sp, setSp] = useState(15)
  const [ep, setEp] = useState(8)
  const stats: StatItem[] = [
    { key: 'sp', label: 'SP', value: sp, outOfMax: 15, onChange: setSp },
    { key: 'ep', label: 'EP', value: ep, outOfMax: 8, onChange: setEp },
  ]
  return (
    <TwoUp
      readOnly={<ReferenceEntityCard data={chassis} />}
      editable={<ReferenceEntityCard data={chassis} statsOverride={stats} />}
    />
  )
}

/**
 * CHOICE-GRANTING equipment (Custom Sniper Rifle): the Weapon Type and
 * Modification choices render inline in the body in BOTH modes — read-only shows
 * every option solid (readable), editable makes them selectable (dim-until-chosen
 * + a "Chosen" stampseal, with the Modification cap counter).
 */
export const ChoiceEquipment: Story = () => {
  const [selections, setSelections] = useState<ChoiceSelections>({})
  const [techLevel, setTechLevel] = useState(1)
  return (
    <TwoUp
      readOnly={<ReferenceEntityCard data={choiceEquip as unknown as SURefEntity} />}
      editable={
        <ReferenceEntityCard
          data={choiceEquip as unknown as SURefEntity}
          selections={selections}
          onSelectionChange={setSelections}
          effectiveTechLevel={techLevel}
          onTechLevelChange={setTechLevel}
        />
      }
    />
  )
}

/**
 * EVERYTHING INLINE (Auto-Turret, Stage 7). Both choices render in the body, at
 * their prose, in BOTH modes — nothing is hoisted to the sub-header:
 *  · Name (source.kind 'text') → a free-text field (read-only shows the value).
 *  · A.I. Personality (source.kind 'table') → its prose + an expandable
 *    "A.I. Personality Table" (a real RollTable with a Roll control), NOT the old
 *    bare text box that cited a table it never showed.
 * The sub-header keeps only the facet hoist (traits) — no "Choose | Name" cell.
 */
export const InlineChoices: Story = () => {
  const [selections, setSelections] = useState<ChoiceSelections>({})
  return (
    <TwoUp
      readOnly={<ReferenceEntityCard data={freeformEquip as unknown as SURefEntity} />}
      editable={
        <ReferenceEntityCard
          data={freeformEquip as unknown as SURefEntity}
          selections={selections}
          onSelectionChange={setSelections}
        />
      }
    />
  )
}

/**
 * TL-SCALING equipment (Custom Sniper Rifle): the effective tech level drives the
 * Modification cap AND the `perTechLevel` Damage datavalue. Two contexts:
 *  · CONTROLLED FROM WITHOUT — `effectiveTechLevel` set, no handler → the header
 *    TL is read-only, but Damage + the Modification cap reflect it (rust border).
 *  · EDITABLE IN PLACE — `onTechLevelChange` present → the header TL is an
 *    editable +/- stepper (floors at the base TL1); Damage + cap update live.
 */
export const TechLevelScaling: Story = () => {
  const [selections, setSelections] = useState<ChoiceSelections>({})
  const [techLevel, setTechLevel] = useState(3)
  return (
    <TwoUp
      readOnly={
        // Controlled from without: TL3 supplied, header read-only, Damage 2→4.
        <ReferenceEntityCard data={choiceEquip as unknown as SURefEntity} effectiveTechLevel={3} />
      }
      editable={
        // Editable in place: bump the header TL stepper to watch the cap + Damage grow.
        <ReferenceEntityCard
          data={choiceEquip as unknown as SURefEntity}
          selections={selections}
          onSelectionChange={setSelections}
          effectiveTechLevel={techLevel}
          onTechLevelChange={setTechLevel}
        />
      }
    />
  )
}
