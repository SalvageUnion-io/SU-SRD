/**
 * PilotSheetItems — the pilot sheet's per-item building blocks (abilities,
 * equipment, generic entries, injuries), extracted from PilotSheet.tsx.
 * Purely presentational and callback-driven — PilotSheet
 * owns all persistence.
 */

import type { ItemCondition } from 'game-domain/schemas/itemCondition'
import type { GenericInventoryEntry } from 'game-domain/schemas/pilot'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { RefAbility } from 'salvageunion-reference'
import type { ChoiceSelections } from '../../components/index'
import {
  AdderBox,
  AdderField,
  Button,
  Entity,
  Input,
  Panel,
  ReferenceEntityCard,
  Stat,
  tokens,
  useDisclosure,
} from '../../components/index'
import { useEntityChoices } from '../../components/shared/useEntityChoices'
import { resolveAbilityApCost } from '../../lib/abilityCost'
import {
  equipmentMaxUses,
  genericEntrySlots,
  resolveEquipment,
} from '../../lib/rules/pilotInventory'
import type { useEntityStore } from '../../stores/entityStore'
import { SheetItemLine, SheetRemoveButton } from './SheetItemLine'
import { UnknownItemLine } from './UnknownItemLine'
import { UsedToggle } from './UsedToggle'

/** An inventory item in Edit: the pill, its control row, then any details. */
const ITEM_EDIT = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  minWidth: 0,
} satisfies CSSProperties

const ROW_TEXT = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
} satisfies CSSProperties

const TRUNCATE = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const ENTRY_TEXT = { flex: '1 1 0%', minWidth: 0 } satisfies CSSProperties

const ENTRY_NAME = {
  ...ROW_TEXT,
  ...TRUNCATE,
  color: tokens.color.ink,
  fontWeight: tokens.weight.medium,
} satisfies CSSProperties

const ENTRY_QTY = {
  color: tokens.color.wkMuted,
  marginLeft: tokens.space[4],
} satisfies CSSProperties

const ENTRY_NOTE = {
  ...TRUNCATE,
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
} satisfies CSSProperties

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
  /**
   * `row` on a tree's track (the SRD's Tree view): the Row, which Peeks the
   * card, its tier numeral in its band and its kind left to the tree's
   * slab, the controls on the line under it; no lead, which is an SRD
   * index's alone (EDL E11, hard rule R35). A Token otherwise.
   */
  form?: 'token' | 'row'
}

/** On a track the tree's slab names the kind. */
const OMIT_KIND = ['kind'] as const

/**
 * One ability: its Token, which Peeks the whole card (owner's call,
 * 2026-10-14: "all references = peek tokens"), with Spend AP and the used
 * toggle on its line in Edit, and a "Used" stamp in Read. AP cost resolves
 * from the ability's actions (resolveAbilityApCost): `null` means no FIXED
 * numeric cost (variable 'X' or none) — no spend control renders, we never
 * spend an undefined amount. The cost itself is the Token's own chip.
 */
export function PilotAbilityItem({
  ability,
  currentAP,
  used,
  onSpend,
  onToggleUsed,
  readOnly,
  form = 'token',
}: PilotAbilityItemProps) {
  const apCost = resolveAbilityApCost(ability)
  return (
    <SheetItemLine
      rowForm={form === 'row'}
      token={
        form === 'row' ? (
          <Entity form="row" entity={ability} mode={{ kind: 'link' }} omit={OMIT_KIND} peek />
        ) : (
          <Entity form="token" context="play" entity={ability} mode={{ kind: 'link' }} />
        )
      }
      name={ability.name}
      readOnly={readOnly}
      stamp={used ? 'Used' : undefined}
      actions={
        <>
          {apCost !== null && (
            <Button
              variant="pencil"
              className="su-sheet-item__ctl"
              aria-label={`Spend ${apCost} AP for ${ability.name}`}
              disabled={currentAP < apCost}
              onClick={() => onSpend(apCost)}
            >
              Spend AP
            </Button>
          )}
          <UsedToggle
            className="su-sheet-item__ctl"
            used={used}
            onToggle={onToggleUsed}
            aria-label={used ? `Recharge ${ability.name}` : `Mark ${ability.name} used`}
          />
        </>
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
   * pilot prop so read-only/snapshot rendering does not depend on the store.
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
 * One inventory item: the shortform pill in both states. Edit adds a row under
 * it — the condition tri-state, uses with Use / Restock, Details (the full card,
 * with its choices) and Remove.
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
  // Edit: whether the full card (its text and any choices) is open under the row.
  const details = useDisclosure()

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

  // The shortform pill — the item named, typed and tech-levelled on one line
  // (board 10). It is the item in BOTH states: the name always wins, and is
  // never ellipsized to make room for a control. A damaged item's pill greys,
  // as its card's header does; it Peeks the whole card.
  const pill = (
    <Entity
      form="token"
      context="inventory"
      entity={equipment}
      instance={{ condition }}
      mode={{ kind: 'link' }}
    />
  )
  // Only an item with choices opens its card under the line: its choices are
  // written there. Everything else the Peek already shows.
  const hasChoices = Array.isArray(equipment.choices) && equipment.choices.length > 0

  // Read: the pill alone (the inventory wraps its pills on a line). Edit: the
  // same line as a mech's Systems and Modules (`SheetItemLine`), Details
  // where there are choices to make.
  if (readOnly) return pill

  return (
    <div style={ITEM_EDIT}>
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
              className="su-sheet-item__ctl"
              {...details.toggleProps}
              aria-label={`${details.open ? 'Collapse' : 'Expand'} ${equipment.name}`}
            >
              Details
            </Button>
          )
        }
        onRemove={onRemove}
      />
      {details.open && (
        <div id={details.panelId}>
          <ReferenceEntityCard
            data={equipment}
            size="compact"
            selections={selections}
            onSelectionChange={setSelections}
            scalingParent={scalingParent}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inventory — generic entries (Scrap at slotCost 3, etc.)
// ---------------------------------------------------------------------------

type GenericEntryCardProps = {
  entry: GenericInventoryEntry
  onRemove?: () => void
}

export function GenericEntryCard({ entry, onRemove }: GenericEntryCardProps) {
  const qty = entry.qty ?? 1
  return (
    <Panel className="su-sheet-pilot-panel-row">
      <div style={ENTRY_TEXT}>
        <div style={ENTRY_NAME}>
          {entry.name}
          {qty > 1 && <span style={ENTRY_QTY}>×{qty}</span>}
        </div>
        {entry.note && <div style={ENTRY_NOTE}>{entry.note}</div>}
      </div>
      <Stat orientation="horizontal" label="Slots" value={genericEntrySlots(entry)} />
      {onRemove && <SheetRemoveButton name={entry.name} onRemove={onRemove} />}
    </Panel>
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
        aria-label="Add Scrap (3 slots)"
        onClick={() => {
          onAdd({ id: crypto.randomUUID(), name: 'Scrap', slotCost: 3 })
        }}
      >
        + Scrap
      </Button>
      <Input
        size="compact"
        type="text"
        value={name}
        aria-label="New item name"
        placeholder="Item name"
        onChange={(e) => setName(e.target.value)}
        style={NAME_INPUT}
      />
      <AdderField label="Slots" htmlFor="new-item-slots">
        <Input
          size="compact"
          id="new-item-slots"
          type="number"
          numeric
          min={0}
          value={slots}
          aria-label="New item slot cost"
          onChange={(e) => setSlots(Number(e.target.value))}
          style={NUMBER_INPUT}
        />
      </AdderField>
      <AdderField label="Qty" htmlFor="new-item-qty">
        <Input
          size="compact"
          id="new-item-qty"
          type="number"
          numeric
          min={1}
          value={qty}
          aria-label="New item quantity"
          onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
          style={NUMBER_INPUT}
        />
      </AdderField>
      <Button
        size="compact"
        disabled={!name.trim()}
        aria-label="Add inventory item"
        onClick={commit}
      >
        Add
      </Button>
    </AdderBox>
  )
}

// Injuries have no slab on the pilot sheet body (the poster has none).
// `Injury`/`injuries` and the max-HP derivation that reads them stay live in
// lib/rules/derivedStats.ts.
