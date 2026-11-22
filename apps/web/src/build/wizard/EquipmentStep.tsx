import { useState } from 'react'
import type { BookCite, ChoiceSelections, RefEquipment } from 'salvageunion-reference'
import { formatProvenance, getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { Badge, EmptyState, ReferenceEntityCard, Stat } from '../../components/index'
import { isPartnerEquipment } from '../../lib/rules/partnerGrants'
import { pilotInventoryCapacity, pilotInventoryUsed } from '../../lib/rules/pilotInventory'
import { isStartingEquipment } from '../../lib/rules/startingEquipment'
import { buildWizardCopy } from '../../messages/build-wizard'
import { PickList } from './PickList'
import { chosenChips, equipmentColumns, openChoices } from './pickColumns'
import { RecapMinis } from './ReviewRecap'
import { SkipToNext } from './SkipToNext'
import { WizMeter } from './WizBudget'

type SUREquipmentAccessor = {
  findAll: (fn: (x: unknown) => boolean) => unknown[]
}

/**
 * Whether the wizard asks the item's choices: the ones a pilot keeps
 * (`Pilot.equipmentChoices`, the item's own). A drone or companion the item
 * grants is set up on the pilot's sheet, as its own card (ADR-028).
 */
const asksAChoice = (item: RefEquipment) =>
  (item.choices?.length ?? 0) > 0 && !isPartnerEquipment(getEntitySlug(item))

type EquipmentStepProps = {
  /** Picked slugs — duplicates allowed (one entry per copy). */
  selectedEquipment: string[]
  /** Set the count of copies for a slug (its Qty stepper). */
  onCountChange: (slug: string, next: number) => void
  /** Selection cap: the total picks the Qty steppers are clamped at. */
  budget: number
  /** The options chosen on an item that asks a choice, by its slug (the form's `equipmentChoices`). */
  choices: Record<string, ChoiceSelections> | undefined
  onChoices: (slug: string, next: ChoiceSelections) => void
  /** Where the book prints the step's rule, on the list's foot. */
  cite: BookCite | undefined
  /** Injectable SUR for testing. */
  _sur?: { Equipment: SUREquipmentAccessor }
}

/**
 * Step 2 · Equipment (Workshop Manual p.19), as a picker in the Ledger form
 * (`PickList`, its count pick). The Tech 1 equipment is one framed list, a
 * line an item: its timing, range, damage and traits in fixed columns and its
 * count's stepper at the line's end. The two picks and the inventory they
 * fill are meters over the list. The line in focus opens as its card beside
 * the list (under its line on a phone), and that card is where its options
 * are chosen: a Custom Sniper Rifle's weapon type and modification are picked
 * there, saved with the pilot (`Pilot.equipmentChoices`), each made choice a
 * chip under the rifle's line and its range and traits in the list already
 * the chosen ones (hard rule R60). Only Tech 1 renders, exactly `budget`
 * picks, duplicates allowed; at the budget every `+` is off.
 */
export function EquipmentStep({
  selectedEquipment,
  onCountChange,
  budget,
  choices,
  onChoices,
  cite,
  _sur,
}: EquipmentStepProps) {
  const surEquipment = _sur?.Equipment ?? SalvageUnionReference.Equipment

  // The injectable accessor is `unknown`-typed for test seams, so the ONE
  // cast lives here: the production accessor really returns `RefEquipment[]`.
  const equipment = surEquipment.findAll((e: unknown) =>
    isStartingEquipment(e as RefEquipment)
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
  const columns = equipmentColumns<RefEquipment>((item) => choices?.[getEntitySlug(item)])

  const card = (item: RefEquipment) => {
    const slug = getEntitySlug(item)
    const count = copies(item)
    const asks = asksAChoice(item)
    const open = asks && count > 0 ? openChoices(item, choices?.[slug]) : 0
    return (
      <ReferenceEntityCard
        data={item}
        size="compact"
        selected={count >= 1}
        // A pick's card says its own rules: no lead line, no flavour.
        hide={{ lead: true, flavor: true, ...(asks ? {} : { choices: true }) }}
        {...(asks
          ? {
              selections: choices?.[slug] ?? {},
              onSelectionChange: (next: ChoiceSelections) => onChoices(slug, next),
            }
          : {})}
        {...(open > 0
          ? { footMeta: [{ label: buildWizardCopy('toChoose', { count: open }), value: '' }] }
          : {})}
      />
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
    <div className="su-wiz-step">
      <div className="su-wiz-budget">
        <WizMeter label={buildWizardCopy('picks')} value={selectedEquipment.length} max={budget} />
        <WizMeter
          label={buildWizardCopy('inventorySlots')}
          value={pilotInventoryUsed({ equipment: selectedEquipment, genericInventory: [] })}
          max={pilotInventoryCapacity()}
        />
      </div>
      <div className="su-wiz-compare-layout su-wiz-compare-layout--wide">
        <div className="su-wiz-compare-main">
          <div>
            <PickList
              title={buildWizardCopy('tech1Equipment')}
              note={
                <Stat
                  label={buildWizardCopy('picks')}
                  value={selectedEquipment.length}
                  max={budget}
                  size="mini"
                />
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
              // The list's foot cites the step's book; an item printed in
              // another says its own book and page on its line (SB-03).
              stamp={(item) =>
                cite && item.source && item.source !== cite.source ? (
                  <Badge shape="stamp" size="mini">
                    {formatProvenance(item.source, undefined, item.page)}
                  </Badge>
                ) : undefined
              }
              under={(item) => chosenChips(item, choices?.[getEntitySlug(item)])}
              detail={card}
              {...(cite
                ? {
                    foot: {
                      cite,
                      meta: {
                        label: buildWizardCopy('choose'),
                        value: buildWizardCopy('duplicatesAllowed', { count: budget }),
                      },
                    },
                  }
                : {})}
            />
          </div>
        </div>
        {/* Past the card's links to Next (r5 C6). */}
        <SkipToNext />
        <div className="su-wiz-compare-detail su-wiz-compare-detail--sticky su-wiz-compare-detail--scroll su-wiz-compare-detail--desk">
          {focused && card(focused)}
          <RecapMinis
            label={buildWizardCopy('yourPicks')}
            entities={picked}
            empty={buildWizardCopy('noneYet')}
          />
        </div>
      </div>
    </div>
  )
}
