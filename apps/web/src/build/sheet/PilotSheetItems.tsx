/**
 * PilotSheetItems — the pilot sheet's per-item building blocks (abilities,
 * equipment, generic entries, injuries). Purely presentational and
 * callback-driven — PilotSheet
 * owns all persistence.
 */

import type { ItemCondition } from 'game-domain/schemas/itemCondition'
import type { GenericInventoryEntry } from 'game-domain/schemas/pilot'
import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import type { RefAbility, RefMetaEntity } from 'salvageunion-reference'
import { extractVisibleActions } from 'salvageunion-reference'
import type { ChoiceSelections } from '../../components/index'
import {
  AdderBox,
  AdderField,
  Button,
  Entity,
  HeaderMenu,
  Input,
  ReferenceEntityCard,
  Stat,
} from '../../components/index'
import { Content } from '../../components/referenceEntity/Content'
import { EntityDetailDialog } from '../../components/referenceEntity/EntityDetailDialog'
import { useEntityChoices } from '../../components/shared/useEntityChoices'
import { resolveAbilityApCost } from '../../lib/abilityCost'
import {
  equipmentMaxUses,
  genericEntrySlots,
  resolveEquipment,
} from '../../lib/rules/pilotInventory'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { useEntityStore } from '../../stores/entityStore'
import { SheetItemLine } from './SheetItemLine'
import { syntheticItemModel } from './syntheticItem.model'
import { UnknownItemLine } from './UnknownItemLine'

/** The adder's inputs, a rung smaller than the `Input` skin. */
const NAME_INPUT = { flex: '1 1 0%', width: '9rem' } satisfies CSSProperties

const NUMBER_INPUT = { width: '3.5rem' } satisfies CSSProperties

/** Per-item condition cycle (Intact → Damaged → Destroyed → Intact). */
const CONDITION_CYCLE: Record<ItemCondition, ItemCondition> = {
  intact: 'damaged',
  damaged: 'destroyed',
  destroyed: 'intact',
}

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------

type PilotAbilityItemProps = {
  ability: RefAbility
  /** Pilot's current AP — gates whether the spend action is enabled. */
  currentAP: number
  /** Whether this ability has been marked used (once-per-rest tracking). */
  used: boolean
  /** Spend this ability's fixed AP cost. Only invoked for fixed numeric costs. */
  onSpend: (cost: number) => void
  onToggleUsed: (next: boolean) => void
  readOnly: boolean
  /** Trained: its body reads its full rules, every action's text, not only its lead. */
  full?: boolean
}

/**
 * A trained ability's full rules under its lead: each of its actions' text,
 * one that is not the ability's own name under its name. Text, never a
 * nested entity (a Mini nests nothing, E6).
 */
function AbilityRules({ ability }: { ability: RefAbility }) {
  const actions = (extractVisibleActions(ability) ?? []).filter((action) => action.content?.length)
  if (actions.length === 0) return null
  return (
    <>
      {actions.map((action) => (
        <div key={action.id} className="su-pilot-ability__rules">
          {action.name !== ability.name && <strong>{action.name}</strong>}
          <Content body={action.content ?? []} compact />
        </div>
      ))}
    </>
  )
}

/**
 * One ability: its CONTENTFUL Mini (N3), its head
 * and then its text, which Peeks the whole card, its "Used" stamp in its state
 * slot, and in Edit a "⋯" in its chip group with Spend AP and Mark used. AP cost resolves
 * from the ability's actions (resolveAbilityApCost): `null` means no FIXED
 * numeric cost (variable 'X' or none) — no spend control renders, we never
 * spend an undefined amount. The cost itself is the Mini's own chip.
 */
export function PilotAbilityItem({
  ability,
  currentAP,
  used,
  onSpend,
  onToggleUsed,
  readOnly,
  full = false,
}: PilotAbilityItemProps) {
  const apCost = resolveAbilityApCost(ability)
  // Spend and Used are one "⋯" in the chip group's last slot (C8): its state
  // slot reads "Used", and a Mini's row stays whole at a phone's width.
  const spend =
    apCost === null
      ? []
      : [
          {
            id: 'spend',
            label: buildSheetCopy('spendAp', { apCost }),
            ...(currentAP < apCost
              ? { hint: buildSheetCopy('needsApLeft', { apCost, currentAP }) }
              : { onSelect: () => onSpend(apCost) }),
          },
        ]
  return (
    <SheetItemLine
      token={
        <Entity
          size="mini"
          context="play"
          entity={ability}
          mode={{ kind: 'link' }}
          body={full ? { children: <AbilityRules ability={ability} /> } : {}}
        />
      }
      name={ability.name}
      readOnly={readOnly}
      stamp={used ? 'Used' : undefined}
      actions={
        <HeaderMenu
          variant="overflow"
          trigger={null}
          label={buildSheetCopy('moreFor', { name: ability.name })}
          sections={[
            [
              ...spend,
              {
                id: 'used',
                label: used ? buildSheetCopy('recharge') : buildSheetCopy('markUsed2'),
                onSelect: () => onToggleUsed(!used),
              },
            ],
          ]}
        />
      }
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
   * pilot prop so a read-only rendering does not depend on the store.
   */
  seedSelections: ChoiceSelections | undefined
  condition: ItemCondition
  /** Uses remaining for this item; undefined = full. */
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
   * Scaling parent for `cardinality.max.scalesWith` choice caps (e.g. the Modification
   * choice scaling with `techLevel`). Undefined leaves the cap unbounded.
   */
  scalingParent: Record<string, unknown> | undefined
  /** Injectable store — forwarded to useEntityChoices for tests. */
  store: typeof useEntityStore
}

/**
 * One inventory item: its contentful Mini in both states. Edit puts the
 * condition tri-state, uses, Details (the full card, with its choices) and
 * Remove in its chip group.
 *
 * A component of its own so it can call the useEntityChoices hook.
 */
export function PilotEquipmentItem({
  slug,
  pilotId,
  seedSelections,
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
  // Edit: Details opens the item's Page (E5, hard rule R6), where its choices
  // are made; nothing expands under the line.
  const [detailsOpen, setDetailsOpen] = useState(false)

  if (!equipment) {
    // Unresolved slug — still shown, still counted (1 slot), still toggleable:
    // the sheet's one unknown-item line.
    return (
      <UnknownItemLine
        slug={slug}
        schemaName="equipment"
        condition={condition}
        readOnly={readOnly}
        onConditionCycle={() => onConditionChange(slug, CONDITION_CYCLE[condition])}
        onRemove={onRemove}
      />
    )
  }

  const maxUses = equipmentMaxUses(equipment)
  const uses = maxUses !== null ? (usesLeft ?? maxUses) : null

  // Slots deliberately absent. Unlike a mech system (whose `slotsRequired`
  // ReferenceEntityCard renders as its own "Slots" stat), an equipment's slot
  // cost is DERIVED — `getInventorySlots`, 1 unless a Heavy/Portable trait makes
  // it 2 — so this was the sheet bolting an extra figure onto the card rather
  // than duplicating one. Either way it is not part of the SRD card, and the
  // inventory band already states slot usage against capacity, once. `Uses`
  // stays: that is live sheet state, not a restatement of reference data.
  //
  // Drone/companion equipment (Survey Drone, Mecha Companion, Auto-Turret)
  // never reaches this component. A granting slug is rendered by `PartnerCard`
  // instead — full width, with the instance's own stats, loadout, conditions
  // and hold — because the grant and the granted thing are one entry to the
  // player (ADR-028). PilotSheet filters those slugs out before mapping here.

  // A CONTENTFUL Mini (N3), in the sheet's
  // sidebar: its head, the item named, typed and tech-levelled on one line,
  // then the item's text under it. It is the item in BOTH states. A damaged
  // item's pill greys, as its card's header does; its head Peeks the whole
  // card, and what of its chips does not fit beside its name is its body's
  // first row (C2b).
  const pill = (
    <Entity
      size="mini"
      context="inventory"
      entity={equipment}
      instance={{ condition }}
      mode={{ kind: 'link' }}
      body={{}}
    />
  )
  // Only an item with choices opens its card under the line: its choices are
  // written there. Everything else the Peek already shows.
  const hasChoices = Array.isArray(equipment.choices) && equipment.choices.length > 0

  // Read: the Mini alone. Edit: the same item line as a mech's Systems and
  // Modules (`SheetItemLine`), Details where there are choices to make.
  if (readOnly) return pill

  return (
    <>
      <SheetItemLine
        token={pill}
        name={equipment.name}
        condition={condition}
        readOnly={false}
        onConditionCycle={() => onConditionChange(slug, CONDITION_CYCLE[condition])}
        uses={
          maxUses !== null && uses !== null
            ? { remaining: uses, max: maxUses, onChange: (next) => onUsesChange(slug, next) }
            : undefined
        }
        actions={
          hasChoices && (
            <Button
              variant="pencil"
              size="mini"
              aria-label={`${equipment.name} details`}
              aria-haspopup="dialog"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen(true)}
            >
              {buildSheetCopy('details')}
            </Button>
          )
        }
        onRemove={onRemove}
      />
      {hasChoices && (
        <EntityDetailDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          entity={equipment as RefMetaEntity}
          title={equipment.name}
        >
          <ReferenceEntityCard
            data={equipment}
            presentation="page"
            selections={selections}
            onSelectionChange={setSelections}
            scalingParent={scalingParent}
          />
        </EntityDetailDialog>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Inventory — generic entries (Scrap at slotCost 3, etc.)
// ---------------------------------------------------------------------------

type GenericEntryLineProps = {
  entry: GenericInventoryEntry
  readOnly: boolean
  onRemove?: () => void
}

/**
 * A generic entry, the carried thing the reference does not hold (ruleset
 * §6.6): a Mini from its synthetic model on the sheet's item line, its note
 * the stamp before its name, `SLOTS | n` in the loadout lane, a quantity above
 * one its state (`× | 4`), and in Edit the one remove control in its chip group.
 */
export function GenericEntryLine({ entry, readOnly, onRemove }: GenericEntryLineProps) {
  const qty = entry.qty ?? 1
  const model = syntheticItemModel({
    name: entry.name,
    id: entry.id,
    schemaName: 'equipment',
    kind: 'Item',
    facts: [{ label: 'Slots', value: genericEntrySlots(entry) }],
    ...(entry.note ? { note: entry.note } : {}),
  })
  return (
    <SheetItemLine
      token={
        <Entity
          size="mini"
          context="loadout"
          model={model}
          mode={{ kind: 'read' }}
          state={qty > 1 ? <Stat label="×" value={qty} size="mini" /> : undefined}
        />
      }
      name={entry.name}
      readOnly={readOnly}
      onRemove={readOnly ? undefined : onRemove}
    />
  )
}

type GenericEntryAdderProps = {
  onAdd: (entry: GenericInventoryEntry) => void
}

/**
 * Minimal generic-entry intake (a generic inventory slot-cost
 * entry). '+ Scrap' is the rules-blessed shortcut (3 slots each);
 * the free form covers everything else with an explicit slot cost.
 */
export function GenericEntryAdder({ onAdd }: GenericEntryAdderProps) {
  const slotsId = useId()
  const qtyId = useId()
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

  return (
    <AdderBox>
      <Button
        size="compact"
        aria-label={buildSheetCopy('addScrap3Slots')}
        onClick={() => {
          onAdd({ id: crypto.randomUUID(), name: 'Scrap', slotCost: 3 })
        }}
      >
        {buildSheetCopy('scrap2')}
      </Button>
      <Input
        size="compact"
        type="text"
        value={name}
        aria-label={buildSheetCopy('newItemName')}
        placeholder={buildSheetCopy('itemName')}
        onChange={(e) => setName(e.target.value)}
        style={NAME_INPUT}
      />
      <AdderField label={buildSheetCopy('slots')} htmlFor={slotsId}>
        <Input
          size="compact"
          id={slotsId}
          type="number"
          numeric
          min={0}
          value={slots}
          aria-label={buildSheetCopy('newItemSlotCost')}
          onChange={(e) => setSlots(Number(e.target.value))}
          style={NUMBER_INPUT}
        />
      </AdderField>
      <AdderField label={buildSheetCopy('qty')} htmlFor={qtyId}>
        <Input
          size="compact"
          id={qtyId}
          type="number"
          numeric
          min={1}
          value={qty}
          aria-label={buildSheetCopy('newItemQuantity')}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
          style={NUMBER_INPUT}
        />
      </AdderField>
      <Button
        size="compact"
        disabled={!name.trim()}
        aria-label={buildSheetCopy('addInventoryItem')}
        onClick={commit}
      >
        {buildSheetCopy('add2')}
      </Button>
    </AdderBox>
  )
}

// Injuries have no slab on the pilot sheet body (the poster has none).
// `Injury`/`injuries` and the max-HP derivation that reads them stay live in
// lib/rules/derivedStats.ts.
