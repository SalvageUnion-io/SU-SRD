/**
 * PilotSheetItems — the pilot sheet's per-item building blocks: an ability's
 * line and its menu, and the generic-entry adder. Callback-driven: the
 * sheet owns persistence.
 */

import type { GenericInventoryEntry } from 'game-domain/schemas/pilot'
import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import type { RefAbility } from 'salvageunion-reference'
import { extractVisibleActions } from 'salvageunion-reference'
import { AdderBox, AdderField } from '../../components/app'
import { Button, Content, Entity, HeaderMenu, Input } from '../../components/index'
import { resolveAbilityApCost } from '../../lib/abilityCost'
import { PILOT_SCRAP_SLOTS } from '../../lib/rules/downtimeEconomy'
import { buildSheetCopy } from '../../messages/build-sheet'
import { SheetItemLine } from './SheetItemLine'

/** The adder's inputs, a rung smaller than the `Input` skin. */
const NAME_INPUT = { flex: '1 1 0%', width: '9rem' } satisfies CSSProperties

const NUMBER_INPUT = { width: '3.5rem' } satisfies CSSProperties

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
  /** Trained: its body reads its full rules, every action's text. Untaken, header-only (R48). */
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
  return (
    <SheetItemLine
      token={
        <Entity
          size="mini"
          // An untaken ability's one line is its name and cost: its action
          // type is its Peek's, so the name has the line and is never cut
          // (r4 E8: two abilities of a tree differ in their last word).
          context={full ? 'play' : 'browse'}
          entity={ability}
          mode={{ kind: 'link' }}
          wholeName
          {...(full ? { body: { children: <AbilityRules ability={ability} /> } } : {})}
        />
      }
      name={ability.name}
      readOnly={readOnly}
      stamp={used ? buildSheetCopy('used') : undefined}
      actions={
        <AbilityMenu
          ability={ability}
          currentAP={currentAP}
          used={used}
          onSpend={onSpend}
          onToggleUsed={onToggleUsed}
        />
      }
    />
  )
}

/**
 * An ability's Edit controls: one "⋯" (C8's last slot) with Spend AP, where
 * its cost is fixed (`resolveAbilityApCost`: `null` is a variable 'X' or no
 * cost, and nothing is spent then), and Mark used / Recharge.
 */
export function AbilityMenu({
  ability,
  currentAP,
  used,
  onSpend,
  onToggleUsed,
}: Pick<PilotAbilityItemProps, 'ability' | 'currentAP' | 'used' | 'onSpend' | 'onToggleUsed'>) {
  const apCost = resolveAbilityApCost(ability)
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
  )
}

// ---------------------------------------------------------------------------
// Inventory — generic entries (Scrap at slotCost 3, etc.)
// ---------------------------------------------------------------------------

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
        aria-label={buildSheetCopy('addScrapSlots', { slots: PILOT_SCRAP_SLOTS })}
        onClick={() => {
          onAdd({ id: crypto.randomUUID(), name: 'Scrap', slotCost: PILOT_SCRAP_SLOTS })
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
