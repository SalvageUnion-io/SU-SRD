/**
 * PilotSheetItems — the pilot sheet's per-item building blocks (abilities,
 * equipment, generic entries, injuries), extracted from PilotSheet.tsx
 * (audit item 19). Purely presentational and callback-driven — PilotSheet
 * owns all persistence.
 */

import { useState } from 'react'
import type { SURefAbility } from 'salvageunion-reference'
import {
  Button,
  Input,
  Panel,
  ReferenceEntityCard,
  type ReferenceEntityControl,
  Stat,
  StatusBadge,
} from 'component-lib'
import type { CardFootMeta, ChoiceSelections } from 'component-lib'

import type { ItemCondition } from '../../lib/schemas/mech'
import type { GenericInventoryEntry } from '../../lib/schemas/pilot'
import { resolveAbilityApCost } from '../../lib/abilityCost'
import type { useEntityStore } from '../../stores/entityStore'
import { useEntityChoices } from '../shared/useEntityChoices'
import type { EquipmentLoadout } from '../shared/useEquipmentLoadout'
import { PilotEquipmentLoadout } from './PilotEquipmentLoadout'
import { CardRemoveButton } from 'component-lib'
import {
  equipmentMaxUses,
  equipmentSlotCost,
  genericEntrySlots,
  isLoadoutHost,
  resolveEquipment,
} from './pilotInventory'

const HIDE_CHOICES = { choices: true } as const

/** Per-item condition cycle (design §4.5: Intact → Damaged → Destroyed → Intact). */
const CONDITION_CYCLE: Record<ItemCondition, ItemCondition> = {
  intact: 'damaged',
  damaged: 'destroyed',
  destroyed: 'intact',
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

  // All interactivity rides the controls bar (no footer actions). Read-only
  // shows a static Used stamp; editable shows Spend AP + the used toggle, with
  // the per-card remove (✕) last, in the card HEADER (G4).
  const controls: ReferenceEntityControl[] = []
  if (readOnly) {
    if (used) controls.push({ key: 'used', badge: 'Used' })
  } else {
    if (apCost !== null) {
      controls.push({
        key: 'spend',
        label: 'Spend AP',
        ariaLabel: `Spend ${apCost} AP for ${ability.name}`,
        onClick: () => {
          onSpend(apCost)
        },
        variant: 'primary',
        disabled: !canSpend,
      })
    }
    controls.push({
      key: 'toggle-used',
      label: used ? 'Recharge' : 'Mark Used',
      ariaLabel: used ? `Recharge ${ability.name}` : `Mark ${ability.name} used`,
      onClick: () => {
        onToggleUsed(!used)
      },
    })
  }

  return (
    <ReferenceEntityCard
      data={ability}
      size="medium"
      collapsible
      hide={HIDE_CHOICES}
      footMeta={footMeta}
      controls={controls.length > 0 ? controls : undefined}
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
  /**
   * Persisted installed loadout for drone/companion equipment (Survey Drone,
   * Mecha Companion, Auto-Turret), sourced from the canonical pilot prop.
   * Undefined for normal gear, which never renders a loadout section.
   */
  seedLoadout: EquipmentLoadout | undefined
  condition: ItemCondition
  /** Uses remaining for this item; undefined = full (rules A14). */
  usesLeft: number | undefined
  onConditionChange: (slug: string, next: ItemCondition) => void
  onUsesChange: (slug: string, next: number) => void
  /**
   * Per-card remove (✕) — always available on editable sheets (unified edit
   * language archetype B). Omit on read-only sheets.
   */
  onRemove?: () => void
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
  seedLoadout,
  condition,
  usesLeft,
  onConditionChange,
  onUsesChange,
  onRemove,
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
        <Stat orientation="horizontal" label="Slots" value={1} />
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
        {!readOnly && onRemove && <CardRemoveButton name={slug} onRemove={onRemove} />}
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
  // Use / Restock ride the controls bar (no footer actions); the per-card
  // remove (✕) stays last, beside the status control in the header (G4).
  const controls: ReferenceEntityControl[] = []
  if (!readOnly && maxUses !== null && uses !== null) {
    controls.push({
      key: 'use',
      label: 'Use',
      ariaLabel: `Use ${equipment.name}`,
      onClick: () => {
        onUsesChange(slug, Math.max(0, uses - 1))
      },
      disabled: uses <= 0,
    })
    controls.push({
      key: 'restock',
      label: 'Restock',
      ariaLabel: `Restock ${equipment.name}`,
      onClick: () => {
        onUsesChange(slug, maxUses)
      },
      variant: 'ghost',
      disabled: uses >= maxUses,
    })
  }

  const equipmentRecord: Record<string, unknown> & { name?: string } = equipment

  // Drone/companion equipment (Survey Drone, Mecha Companion, Auto-Turret)
  // carries its own systemSlots/moduleSlots, so it hosts a real installed
  // loadout edited with the same picker mechs use. It renders INSIDE the host
  // card's body (the `afterExtraContent` slot) rather than as sibling sections
  // beneath it — the loadout belongs to that drone, and floating it outside
  // read as two unrelated sections that happened to sit next to each other.
  const loadout = isLoadoutHost(equipmentRecord) ? (
    <PilotEquipmentLoadout
      pilotId={pilotId}
      slug={slug}
      equipment={equipmentRecord}
      seed={seedLoadout}
      readOnly={readOnly}
      store={store}
    />
  ) : undefined

  return (
    <ReferenceEntityCard
      data={equipment}
      size="medium"
      collapsible
      afterExtraContent={loadout}
      selections={selections}
      onSelectionChange={readOnly ? undefined : setSelections}
      scalingParent={scalingParent}
      status={condition}
      onStatusClick={
        readOnly
          ? undefined
          : () => {
              onConditionChange(slug, CONDITION_CYCLE[condition])
            }
      }
      footMeta={footMeta}
      controls={controls.length > 0 ? controls : undefined}
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
      <Stat orientation="horizontal" label="Slots" value={genericEntrySlots(entry)} />
      {onRemove && (
        <Button
          size="compact"
          variant="ghost"
          aria-label={`Remove ${entry.name}`}
          onClick={onRemove}
        >
          Remove
        </Button>
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

  const compactInput = 'px-2 py-1.5 text-xs'

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[3px] border-chrome border-dashed border-wk-faint p-2.5">
      <Button
        size="compact"
        aria-label="Add Scrap (3 slots)"
        onClick={() => {
          onAdd({ id: crypto.randomUUID(), name: 'Scrap', slotCost: 3 })
        }}
      >
        + Scrap
      </Button>
      <Input
        type="text"
        value={name}
        aria-label="New item name"
        placeholder="Item name"
        onChange={(e) => setName(e.target.value)}
        className={`${compactInput} w-36 flex-1`}
      />
      <label
        htmlFor="new-item-slots"
        className="flex items-center gap-1 font-cond text-label font-bold uppercase tracking-wide text-wk-muted"
      >
        Slots
        <Input
          id="new-item-slots"
          type="number"
          min={0}
          value={slots}
          aria-label="New item slot cost"
          onChange={(e) => setSlots(Number(e.target.value))}
          className={`${compactInput} w-14`}
        />
      </label>
      <label
        htmlFor="new-item-qty"
        className="flex items-center gap-1 font-cond text-label font-bold uppercase tracking-wide text-wk-muted"
      >
        Qty
        <Input
          id="new-item-qty"
          type="number"
          min={1}
          value={qty}
          aria-label="New item quantity"
          onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
          className={`${compactInput} w-14`}
        />
      </label>
      <Button
        size="compact"
        disabled={!name.trim()}
        aria-label="Add inventory item"
        onClick={commit}
      >
        Add
      </Button>
    </div>
  )
}

// Injuries — the "Injuries" slab + `InjuryRow` (redesign D6: no poster
// counterpart) were dropped from the pilot sheet body; tracked for a future
// off-sheet re-home as #408. `Injury`/`injuries` and the max-HP derivation
// that reads them stay live in lib/rules/derivedStats.ts.
