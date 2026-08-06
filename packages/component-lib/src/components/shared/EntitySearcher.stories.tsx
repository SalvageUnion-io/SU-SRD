import type { Story } from '@ladle/react'
import { useState } from 'react'
import { getChoices, nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { Button } from '../chrome/Button'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { CatalogChoiceModal } from '../referenceEntity/choiceCard/CatalogChoiceModal'
import type { ChoiceSelections } from '../referenceEntity/choiceCard/choiceSelectionHelpers'
import { EntitySearcher } from './EntitySearcher'
import { MasonryColumns } from './MasonryColumns'

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
 * header, search + filters in the sub-header band, the pool filling a padded
 * internally-scrolling body, and the "Results" box pinned floating bottom-right.
 * This is the one layout — the Catalog modal and every sheet picker use it (in a
 * bare ModalShell).
 */
export const Default: Story = () => {
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (ref: string) =>
    setSelected((s) => (s.includes(ref) ? s.filter((r) => r !== ref) : [...s, ref]))
  return (
    <div className="flex flex-col gap-3">
      <Caption>
        Search + filters in the sub-header, pool fills the body, the Results box floats pinned
        bottom-right.
      </Caption>
      <div className="mx-auto w-full max-w-5xl">
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
 * render; both used to run a bespoke master/detail pair whose narrow option
 * rail was thinner than a chassis card's own artwork, so every option came out
 * clipped and unreadably tall. Here the two-column masonry gives each card its
 * natural width, `hide.patterns` drops the section a picker can't act on, and
 * `railActions` carries the Apply/Cancel pair the destructive flow needs.
 */
export const BigEntitySingleSelect: Story = () => {
  const [selected, setSelected] = useState<string>(
    nameToSlug(SalvageUnionReference.Chassis.all()[0]?.name ?? '')
  )
  return (
    <div className="flex flex-col gap-3">
      <Caption>
        Single-select over `chassis` — a `radiogroup` pool, one Chosen entry in the rail, and the
        picker's actions pinned beneath it.
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
  const bay = SalvageUnionReference.CrawlerBays.all().find((b) => b.name === 'Armament Bay')
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
