import { useState } from 'react'
import {
  getChoices,
  getSlotsRequired,
  nameToSlug,
  SalvageUnionReference,
} from 'salvageunion-reference'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Button } from '../chrome/Button'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { CatalogChoiceModal } from '../referenceEntity/choiceCard/CatalogChoiceModal'
import type { ChoiceSelections } from '../referenceEntity/choiceCard/choiceSelectionHelpers'
import { EntitySearcher } from './EntitySearcher'
import { MasonryColumns } from './MasonryColumns'
import { PICKER_MODAL_WIDTH } from './pickerModalWidth'

/**
 * EntitySearcher — the shared "add an entity" body (search + Tech-Level / trait
 * facets + selection rail). Now in component-lib so both ITUN's live-sheet
 * pickers and the reference card's catalog-choice modal share one picker. This
 * file also covers its selection cells (MasonryColumns packing plain
 * ReferenceEntityCard cards) and the CatalogChoiceModal that wraps it for a
 * single-select catalog choice.
 */
export default {
  title: 'Compositions/Catalog/Entity Searcher',
}

/**
 * EntitySearcher is a self-contained Card: title + close badge in the
 * header, search + filters in the sub-header band, then the pool and the
 * selection rail — which never sits over the results. Narrower than 80rem the
 * rail is a sticky band above the pool (collapsed: the count; expanded: the
 * chosen heads and their Remove buttons); from 80rem it is a scrolling column
 * to the pool's right. Resize the story across 1280px to see both. Below 1280px
 * the sub-header is only the search field and a Filters disclosure (folded on a
 * phone), and the frame is capped at the viewport with the body scrolling under
 * it, so on a phone nothing is pushed below a fold. This is the one layout — the Catalog modal and every sheet picker use it (in a bare
 * ModalShell, at `PICKER_MODAL_WIDTH`, which this frame mirrors).
 */
export const Default: Story = () => {
  const [selected, setSelected] = useState<string[]>(() =>
    SalvageUnionReference.Equipment.all()
      .slice(0, 2)
      .map((e) => e.name)
  )
  const toggle = (ref: string) =>
    setSelected((s) => (s.includes(ref) ? s.filter((r) => r !== ref) : [...s, ref]))
  return (
    <div className="flex flex-col gap-3">
      <Caption>
        Search + filters in the sub-header; the rail is a band above the pool below 1280px and a
        column beside it from there.
      </Caption>
      <div className={`mx-auto w-full ${PICKER_MODAL_WIDTH}`}>
        <EntitySearcher
          schema="equipment"
          selected={selected}
          onToggle={toggle}
          chosenLabel="Chosen"
          title="Choose Equipment"
          onClose={() => {}}
        />
      </div>
    </div>
  )
}

/**
 * `mode="single"` — the exactly-one picker, shown on the largest entity in the
 * data. This is what ITUN's Change Chassis and Change Crawler Type modals
 * render. The two-column masonry gives each card its
 * natural width, `hide.patterns` drops the section a picker can't act on, and
 * `railActions` carries the Apply/Cancel pair the destructive flow needs. The
 * rail is a one-line bar (the chosen name + those actions) at every width, so
 * the pool keeps the full frame — this modal stays at `max-w-5xl`.
 */
export const BigEntitySingleSelect: Story = () => {
  const [selected, setSelected] = useState<string>(
    nameToSlug(SalvageUnionReference.Chassis.all()[0]?.name ?? '')
  )
  return (
    <div className="flex flex-col gap-3">
      <Caption>
        Single-select over `chassis` — a `radiogroup` pool under a one-line Chosen bar that carries
        the picker's actions, at every width.
      </Caption>
      <div className="mx-auto w-full max-w-5xl">
        <EntitySearcher
          schema="chassis"
          mode="single"
          selected={selected ? [selected] : []}
          onToggle={(ref) => setSelected((prev) => (prev === ref ? '' : ref))}
          idOf={(item) => nameToSlug(item.name)}
          hide={{ patterns: true }}
          facets={{ status: false }}
          chosenLabel="Chosen"
          title="Change Chassis"
          subtitle="Swapping chassis clears the current loadout."
          emptyMessage="No matching chassis."
          onClose={() => {}}
          railActions={
            <>
              <Button variant="ghost" size="compact">
                Cancel
              </Button>
              <Button size="compact" disabled={!selected}>
                Apply chassis
              </Button>
            </>
          }
        />
      </div>
    </div>
  )
}

/**
 * `mode="count"` with two soft budgets — the mech sheet's Add Systems picker,
 * and the tallest rail there is: duplicates are legal, so each copy is its own
 * entry ("Copy 1 of 2") with its own Remove, and System Slots / Energy are
 * tracked against a real chassis (the Mule). Collapsed on a narrow screen the
 * band reads both budgets as one line of text, in red once over.
 */
export const CountWithBudget: Story = () => {
  const mule = SalvageUnionReference.Chassis.getByName('Mule')
  const [installed, setInstalled] = useState<string[]>(() => {
    const [gun, plating] = SalvageUnionReference.Systems.all()
    return gun && plating ? [gun.name, gun.name, plating.name] : []
  })
  if (!mule) return <Caption>Mule chassis fixture missing.</Caption>
  const slotsUsed = installed.reduce((n, name) => {
    const system = SalvageUnionReference.Systems.getByName(name)
    return n + (system ? (getSlotsRequired(system) ?? 0) : 0)
  }, 0)
  return (
    <div className="flex flex-col gap-3">
      <Caption>
        Count mode over `systems` — duplicate copies, each removable, against the Mule's System
        Slots and Energy.
      </Caption>
      <div className={`mx-auto w-full ${PICKER_MODAL_WIDTH}`}>
        <EntitySearcher
          schema="systems"
          mode="count"
          selected={installed}
          onAdd={(name) => setInstalled((s) => [...s, name])}
          onRemove={(index) => setInstalled((s) => s.filter((_, i) => i !== index))}
          railName={mule.name}
          chosenLabel="Installed"
          title="Add Systems"
          emptyMessage="No systems match those filters."
          budget={[
            { label: 'System Slots', used: slotsUsed, max: mule.systemSlots },
            { label: 'Energy', used: mule.energyPoints, max: mule.energyPoints, tone: 'ap' },
          ]}
          onClose={() => {}}
        />
      </div>
    </div>
  )
}

export const Cells: Story = () => {
  const [chosen, setChosen] = useState<string>('')
  const items = SalvageUnionReference.Equipment.all().slice(0, 4)
  return (
    <div className="flex flex-col gap-3">
      <Caption>
        MasonryColumns packs the selection cells — each is a plain ReferenceEntityCard with the
        card's native `selected` ring + radio a11y (no SelCard wrapper).
      </Caption>
      <MasonryColumns maxColumns={2} radio ariaLabel="Equipment">
        {items.map((item) => (
          <ReferenceEntityCard
            key={item.id}
            data={item}
            size="medium"
            selected={chosen === item.name}
            selectionRole="radio"
            cardClickLabel={item.name}
            onCardClick={() => setChosen((c) => (c === item.name ? '' : item.name))}
            hide={{ actions: true, choices: true }}
          />
        ))}
      </MasonryColumns>
    </div>
  )
}

export const CatalogPicker: Story = () => {
  const [open, setOpen] = useState(false)
  const [selections, setSelections] = useState<ChoiceSelections>({})
  const bay = SalvageUnionReference.CrawlerBays.getByName('Armament Bay')
  const choice = bay ? (getChoices(bay) ?? [])[0] : undefined
  if (!choice) return <Caption>Armament Bay fixture missing.</Caption>
  const chosen = selections[choice.id]?.[0]
  return (
    <div className="flex flex-col items-start gap-3">
      <Caption>
        CatalogChoiceModal — the Armament Bay Weapons System pick (any SP-damage system).
      </Caption>
      <Button variant="primary" size="mini" onClick={() => setOpen(true)}>
        {chosen ? `Change — ${chosen}` : 'Choose a Weapons System…'}
      </Button>
      <CatalogChoiceModal
        open={open}
        onClose={() => setOpen(false)}
        choice={choice}
        selected={selections[choice.id] ?? []}
        onSelect={(values) => setSelections((s) => ({ ...s, [choice.id]: values }))}
      />
    </div>
  )
}
