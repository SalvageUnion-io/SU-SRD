import { useState } from 'react'
import type { ChoiceSelections, RefEquipment } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { isLegalCreationEquipment } from 'salvageunion-reference/rules'
import { EmptyState, ReferenceEntityCard, Stat } from '../../components/index'
import { pilotInventoryCapacity, pilotInventoryUsed } from '../../lib/rules/pilotInventory'
import { buildWizardCopy } from '../../messages/build-wizard'
import { PickList } from './PickList'
import { choicesOf, chosenChips, equipmentColumns, openChoices } from './pickColumns'
import { RecapMinis } from './ReviewRecap'
import { WizMeter } from './WizShell'

type SUREquipmentAccessor = {
  findAll: (fn: (x: unknown) => boolean) => unknown[]
}

type EquipmentStepProps = {
  /** Picked slugs — duplicates allowed (one entry per copy). */
  selectedEquipment: string[]
  /** Set the count of copies for a slug (its Qty stepper). */
  onCountChange: (slug: string, next: number) => void
  /** Selection cap: the total picks the Qty steppers are clamped at. */
  budget: number
  /** MOCK (wave 2): each pick's chosen options, by slug, and their setter. */
  choices?: Record<string, ChoiceSelections>
  onChoices?: (slug: string, next: ChoiceSelections) => void
  /** Injectable SUR for testing. */
  _sur?: { Equipment: SUREquipmentAccessor }
}

/**
 * MOCK (Working Manual, wave 2) · Step 2 · Equipment, as a picker in the
 * Ledger form (`PickList`, its count pick). The Tech 1 equipment is one framed
 * list, a line an item: its timing, range, damage and traits in fixed columns
 * and its count's stepper at the line's end. The two picks and the inventory
 * they fill are meters over the list. The line in focus opens as its card
 * beside the list (under its line on a phone), and that card is where its
 * options are chosen: a Custom Sniper Rifle's weapon type and modification
 * are picked there, each made choice a chip under the rifle's line and its
 * range and traits in the list already the chosen ones (hard rule R60).
 * The rules are unchanged: only Tech 1 renders, exactly `budget` picks,
 * duplicates allowed; at the budget every `+` is off.
 */
export function EquipmentStep({
  selectedEquipment,
  onCountChange,
  budget,
  choices = {},
  onChoices,
  _sur,
}: EquipmentStepProps) {
  const surEquipment = _sur?.Equipment ?? SalvageUnionReference.Equipment

  // The injectable accessor is `unknown`-typed for test seams, so the ONE
  // cast lives here: the production accessor really returns `RefEquipment[]`.
  const equipment = surEquipment.findAll((e: unknown) =>
    isLegalCreationEquipment(e as RefEquipment)
  ) as RefEquipment[]

  const copies = (item: RefEquipment) =>
    selectedEquipment.filter((slug) => slug === getEntitySlug(item)).length
  const remaining = Math.max(0, budget - selectedEquipment.length)
  const [focus, setFocus] = useState<string | undefined>(undefined)
  const shown = focus ?? (equipment[0] ? getEntitySlug(equipment[0]) : undefined)
  const focused = equipment.find((item) => getEntitySlug(item) === shown)
  const picked = selectedEquipment.flatMap((slug) => {
    const found = equipment.find((item) => getEntitySlug(item) === slug)
    return found ? [found] : []
  })
  const columns = equipmentColumns<RefEquipment>((item) => choices[getEntitySlug(item)])

  const card = (item: RefEquipment) => {
    const slug = getEntitySlug(item)
    const count = copies(item)
    const asks = choicesOf(item).length > 0 && onChoices !== undefined
    const open = count > 0 ? openChoices(item, choices[slug]) : 0
    return (
      <div className="su-wiz-own-rules">
        <ReferenceEntityCard
          data={item}
          size="compact"
          selected={count >= 1}
          hide={asks ? {} : { choices: true }}
          controls={[
            {
              key: 'qty',
              stepper: {
                label: buildWizardCopy('qty'),
                subject: `${item.name} count`,
                value: count,
                ceiling: count + remaining,
                onChange: (next) => onCountChange(slug, next),
              },
            },
          ]}
          {...(asks
            ? {
                selections: choices[slug] ?? {},
                onSelectionChange: (next: ChoiceSelections) => onChoices(slug, next),
              }
            : {})}
          {...(open > 0 ? { footMeta: [{ label: `${open} to choose`, value: '' }] } : {})}
        />
      </div>
    )
  }

  if (equipment.length === 0) {
    return (
      <EmptyState
        headline={buildWizardCopy('noEquipment')}
        body={buildWizardCopy('noTechLevel1Equipment')}
      />
    )
  }

  return (
    <div className="su-wiz-stack su-wiz-stack--12">
      <div className="su-wiz-budget">
        <WizMeter label="Picks" value={selectedEquipment.length} max={budget} />
        <WizMeter
          label="Inventory slots"
          value={pilotInventoryUsed({ equipment: selectedEquipment, genericInventory: [] })}
          max={pilotInventoryCapacity()}
        />
      </div>
      <div className="su-wiz-compare-layout su-wiz-compare-layout--wide">
        <div className="su-wiz-compare-main">
          <div>
            <PickList
              title="Tech 1 Equipment"
              note={
                <Stat label="Picks" value={selectedEquipment.length} max={budget} size="mini" />
              }
              rows={equipment}
              rowKey={getEntitySlug}
              rowName={(item) => item.name}
              columns={columns}
              selected={shown}
              onSelect={setFocus}
              count={{
                label: buildWizardCopy('qty'),
                value: copies,
                max: (item) => copies(item) + remaining,
                onChange: (item, next) => {
                  setFocus(getEntitySlug(item))
                  onCountChange(getEntitySlug(item), next)
                },
              }}
              under={(item) => chosenChips(item, choices[getEntitySlug(item)])}
              detail={card}
              foot={{
                cite: 'Workshop Manual · p.19 · Pilot Equipment pp.78–87',
                meta: { label: 'Choose', value: `${budget}, duplicates allowed` },
              }}
            />
          </div>
        </div>
        <div className="su-wiz-compare-detail su-wiz-compare-detail--sticky su-wiz-compare-detail--scroll su-wiz-compare-detail--desk">
          {focused && card(focused)}
          <div>
            <RecapMinis label="Your picks" entities={picked} empty="None yet" />
          </div>
        </div>
      </div>
    </div>
  )
}
