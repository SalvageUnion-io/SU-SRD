/**
 * PilotSheetItems — the pilot sheet's per-item building blocks (abilities,
 * equipment, generic entries, injuries), extracted from PilotSheet.tsx
 * (audit item 19). Purely presentational and callback-driven — PilotSheet
 * owns all persistence.
 */

import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefAbility, SURefEntity } from 'salvageunion-reference'
import { Btn, Panel, ReferenceEntityDisplay, Spec, StatusBadge, Tag } from 'suref-react'
import type { CardFootMeta, ChoiceSelections, EntityStatus } from 'suref-react'

import type { ItemCondition } from '../../lib/schemas/mech'
import type { GenericInventoryEntry, Injury } from '../../lib/schemas/pilot'
import { resolveAbilityApCost } from '../../lib/abilityCost'
import { useEntityStore } from '../../stores/entityStore'
import { useEntityChoices } from '../shared/useEntityChoices'
import {
  equipmentMaxUses,
  equipmentSlotCost,
  genericEntrySlots,
  resolveEquipment,
} from './pilotInventory'

const HIDE_CHOICES = { choices: true } as const

/** Per-item condition cycle (design §4.5: Intact → Damaged → Destroyed → Intact). */
const CONDITION_CYCLE: Record<ItemCondition, ItemCondition> = {
  intact: 'damaged',
  damaged: 'destroyed',
  destroyed: 'intact',
}

// eslint-disable-next-line react-refresh/only-export-components -- shared control helpers, colocated by design (audit items 24/19)
export function resolveAbility(slug: string): SURefAbility | null {
  const all = SalvageUnionReference.Abilities.all() as ReadonlyArray<SURefAbility>
  return all.find((a) => a.id === slug || a.name === slug) ?? null
}

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------

type PilotAbilityItemProps = {
  ability: SURefAbility
  /** Pilot's current AP — gates whether the spend action is enabled. */
  currentAP: number
  /** Whether this ability has been marked used (once-per-rest tracking). */
  used: boolean
  /** Spend this ability's fixed AP cost. Only invoked for fixed numeric costs. */
  onSpend: (cost: number) => void
  onToggleUsed: (next: boolean) => void
  readOnly: boolean
}

/**
 * One ability card. AP cost resolves from the ability's actions
 * (resolveAbilityApCost): `null` means no FIXED numeric cost (variable 'X' or
 * none) — no spend button renders, we never spend an undefined amount.
 */
export function PilotAbilityItem({
  ability,
  currentAP,
  used,
  onSpend,
  onToggleUsed,
  readOnly,
}: PilotAbilityItemProps) {
  const apCost = resolveAbilityApCost(ability)
  const canSpend = apCost !== null && currentAP >= apCost

  const footMeta: CardFootMeta[] = [{ label: 'AP Cost', value: apCost ?? '—' }]
  const footActions = readOnly ? (
    used ? (
      <Tag label="Used" />
    ) : undefined
  ) : (
    <>
      {apCost !== null && (
        <Btn
          size="sm"
          variant="primary"
          disabled={!canSpend}
          aria-label={`Spend ${apCost} AP for ${ability.name}`}
          onClick={() => {
            onSpend(apCost)
          }}
        >
          Spend AP
        </Btn>
      )}
      <Btn
        size="sm"
        aria-pressed={used}
        aria-label={used ? `Recharge ${ability.name}` : `Mark ${ability.name} used`}
        onClick={() => {
          onToggleUsed(!used)
        }}
      >
        {used ? 'Recharge' : 'Mark Used'}
      </Btn>
    </>
  )

  return (
    <ReferenceEntityDisplay
      data={ability as unknown as SURefEntity}
      compact
      label={ability.tree}
      hide={HIDE_CHOICES}
      footMeta={footMeta}
      footActions={footActions}
    />
  )
}

// ---------------------------------------------------------------------------
// Inventory — reference equipment
// ---------------------------------------------------------------------------

type PilotEquipmentItemProps = {
  /** Equipment slug as stored on the pilot. */
  slug: string
  /** Owning pilot id — choice selections persist under this entity. */
  pilotId: string
  /**
   * Persisted choice selections for this item, sourced from the canonical
   * pilot prop so read-only/snapshot rendering does not depend on the store.
   */
  seedSelections: ChoiceSelections | undefined
  condition: ItemCondition
  /** Uses remaining for this item; undefined = full (rules A14). */
  usesLeft: number | undefined
  onConditionChange: (slug: string, next: ItemCondition) => void
  onUsesChange: (slug: string, next: number) => void
  readOnly: boolean
  /**
   * Scaling parent for `scalesWithField` choice caps (e.g. the Modification
   * choice scaling with `techLevel`). Undefined leaves the cap unbounded.
   */
  scalingParent: Record<string, unknown> | undefined
  /** Injectable store — forwarded to useEntityChoices for tests. */
  store: typeof useEntityStore
}

/**
 * One inventory equipment card: choice cards enabled, condition cycled via the
 * card's status badge, uses counted in the foot with Use / Restock actions.
 *
 * Extracted from the map body so it can legally call the useEntityChoices hook.
 */
export function PilotEquipmentItem({
  slug,
  pilotId,
  seedSelections,
  condition,
  usesLeft,
  onConditionChange,
  onUsesChange,
  readOnly,
  scalingParent,
  store,
}: PilotEquipmentItemProps) {
  const equipment = resolveEquipment(slug)
  const { selections, setSelections } = useEntityChoices(
    'pilot',
    pilotId,
    slug,
    'equipmentChoices',
    seedSelections,
    store
  )

  if (!equipment) {
    // Unresolved slug — still shown, still counted (1 slot), still toggleable.
    return (
      <Panel className="flex items-center gap-3 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate font-body text-sm text-wk-muted">{slug}</span>
        <Spec label="Slots" value={1} />
        <StatusBadge
          status={condition}
          onClick={
            readOnly
              ? undefined
              : () => {
                  onConditionChange(slug, CONDITION_CYCLE[condition])
                }
          }
        />
      </Panel>
    )
  }

  const slotCost = equipmentSlotCost(equipment)
  const maxUses = equipmentMaxUses(equipment)
  const uses = maxUses !== null ? (usesLeft ?? maxUses) : null

  const footMeta: CardFootMeta[] = [
    { label: 'Slots', value: slotCost },
    ...(maxUses !== null ? [{ label: 'Uses', value: `${uses}/${maxUses}` }] : []),
  ]
  const footActions =
    !readOnly && maxUses !== null && uses !== null ? (
      <>
        <Btn
          size="sm"
          disabled={uses <= 0}
          aria-label={`Use ${equipment.name}`}
          onClick={() => {
            onUsesChange(slug, Math.max(0, uses - 1))
          }}
        >
          Use
        </Btn>
        <Btn
          size="sm"
          variant="ghost"
          disabled={uses >= maxUses}
          aria-label={`Restock ${equipment.name}`}
          onClick={() => {
            onUsesChange(slug, maxUses)
          }}
        >
          Restock
        </Btn>
      </>
    ) : undefined

  return (
    <ReferenceEntityDisplay
      data={equipment as unknown as SURefEntity}
      compact
      selections={selections}
      onSelectionChange={readOnly ? undefined : setSelections}
      scalingParent={scalingParent}
      status={condition as EntityStatus}
      onStatusClick={
        readOnly
          ? undefined
          : () => {
              onConditionChange(slug, CONDITION_CYCLE[condition])
            }
      }
      footMeta={footMeta}
      footActions={footActions}
    />
  )
}

// ---------------------------------------------------------------------------
// Inventory — generic entries (plan S7: Scrap at slotCost 3, etc.)
// ---------------------------------------------------------------------------

type GenericEntryCardProps = {
  entry: GenericInventoryEntry
  onRemove?: () => void
}

export function GenericEntryCard({ entry, onRemove }: GenericEntryCardProps) {
  const qty = entry.qty ?? 1
  return (
    <Panel className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate font-body text-sm font-medium text-ink">
          {entry.name}
          {qty > 1 && <span className="ml-1 text-wk-muted">×{qty}</span>}
        </div>
        {entry.note && <div className="truncate font-body text-xs text-wk-muted">{entry.note}</div>}
      </div>
      <Spec label="Slots" value={genericEntrySlots(entry)} />
      {onRemove && (
        <Btn size="sm" variant="ghost" aria-label={`Remove ${entry.name}`} onClick={onRemove}>
          Remove
        </Btn>
      )}
    </Panel>
  )
}

type GenericEntryAdderProps = {
  onAdd: (entry: GenericInventoryEntry) => void
}

/**
 * Minimal generic-entry intake (design-review item: 'generic inventory
 * slot-cost entry'). '+ Scrap' is the rules-blessed shortcut (3 slots each);
 * the free form covers everything else with an explicit slot cost.
 */
export function GenericEntryAdder({ onAdd }: GenericEntryAdderProps) {
  const [name, setName] = useState('')
  const [slots, setSlots] = useState(1)
  const [qty, setQty] = useState(1)

  function commit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({
      id: crypto.randomUUID(),
      name: trimmed,
      slotCost: Math.max(0, slots),
      ...(qty > 1 ? { qty } : {}),
    })
    setName('')
    setSlots(1)
    setQty(1)
  }

  const inputClass =
    'rounded-[3px] border-chrome border-ink bg-paper px-2 py-1.5 font-body text-xs text-ink focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]'

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[3px] border-chrome border-dashed border-wk-faint p-2.5">
      <Btn
        size="sm"
        aria-label="Add Scrap (3 slots)"
        onClick={() => {
          onAdd({ id: crypto.randomUUID(), name: 'Scrap', slotCost: 3 })
        }}
      >
        + Scrap
      </Btn>
      <input
        type="text"
        value={name}
        aria-label="New item name"
        placeholder="Item name"
        onChange={(e) => setName(e.target.value)}
        className={`${inputClass} w-36 flex-1`}
      />
      <label className="flex items-center gap-1 font-cond text-label font-bold uppercase tracking-wide text-wk-muted">
        Slots
        <input
          type="number"
          min={0}
          value={slots}
          aria-label="New item slot cost"
          onChange={(e) => setSlots(Number(e.target.value))}
          className={`${inputClass} w-14`}
        />
      </label>
      <label className="flex items-center gap-1 font-cond text-label font-bold uppercase tracking-wide text-wk-muted">
        Qty
        <input
          type="number"
          min={1}
          value={qty}
          aria-label="New item quantity"
          onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
          className={`${inputClass} w-14`}
        />
      </label>
      <Btn size="sm" disabled={!name.trim()} aria-label="Add inventory item" onClick={commit}>
        Add
      </Btn>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Injuries
// ---------------------------------------------------------------------------

type InjuryRowProps = {
  injury: Injury
  index: number
  onChange?: (next: Injury) => void
  onRemove?: () => void
}

export function InjuryRow({ injury, index, onChange, onRemove }: InjuryRowProps) {
  const penalty = injury.severity === 'major' ? 2 : 1
  if (!onChange || !onRemove) {
    return (
      <Panel className="flex items-center gap-3 px-3 py-2">
        <Tag label={injury.severity} value={`−${penalty} HP`} />
        <span className="min-w-0 flex-1 truncate font-body text-sm text-ink">
          {injury.note || '—'}
        </span>
      </Panel>
    )
  }
  return (
    <Panel className="flex flex-wrap items-center gap-3 px-3 py-2">
      <select
        value={injury.severity}
        aria-label={`Injury ${index + 1} severity`}
        onChange={(e) => {
          onChange({
            ...injury,
            severity: e.target.value === 'major' ? 'major' : 'minor',
          })
        }}
        className="rounded-[3px] border-chrome border-ink bg-paper px-2 py-1.5 font-cond text-xs font-semibold uppercase text-ink focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]"
      >
        <option value="minor">Minor (−1 max HP)</option>
        <option value="major">Major (−2 max HP)</option>
      </select>
      <input
        type="text"
        defaultValue={injury.note}
        aria-label={`Injury ${index + 1} note`}
        placeholder="What happened?"
        onBlur={(e) => {
          const next = e.target.value
          if (next !== injury.note) onChange({ ...injury, note: next })
        }}
        className="w-40 min-w-0 flex-1 rounded-[3px] border-chrome border-ink bg-paper px-2 py-1.5 font-body text-xs text-ink focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]"
      />
      <Btn size="sm" variant="ghost" aria-label={`Remove injury ${index + 1}`} onClick={onRemove}>
        Remove
      </Btn>
    </Panel>
  )
}
