import type { Story } from '@ladle/react'
import { useState } from 'react'
import { getChoices, SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { ReferenceEntityDisplay } from '../referenceEntity/card/referenceEntityDisplayShim'
import { CatalogChoiceModal } from '../referenceEntity/choiceCard/CatalogChoiceModal'
import type { ChoiceSelections } from '../referenceEntity/choiceCard/choiceSelectionHelpers'
import { EntitySearcher } from './EntitySearcher'
import { MasonryColumns } from './MasonryColumns'

/**
 * EntitySearcher — the shared "add an entity" body (search + Tech-Level / trait
 * facets + selection rail). Now in component-lib so both ITUN's live-sheet
 * pickers and the reference card's catalog-choice modal share one picker. This
 * file also covers its selection cells (MasonryColumns packing plain
 * ReferenceEntityDisplay cards) and the CatalogChoiceModal that wraps it for a
 * single-select catalog choice.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/Entity Searcher',
}

/**
 * EntitySearcher is a self-contained DisplayCard: title + close badge in the
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

export const Cells: Story = () => {
  const [chosen, setChosen] = useState<string>('')
  const items = SalvageUnionReference.Equipment.all().slice(0, 4)
  return (
    <div className="flex flex-col gap-3">
      <Caption>
        MasonryColumns packs the selection cells — each is a plain ReferenceEntityDisplay with the
        card's native `selected` ring + radio a11y (no SelCard wrapper).
      </Caption>
      <MasonryColumns maxColumns={2} radio ariaLabel="Equipment">
        {items.map((item) => (
          <ReferenceEntityDisplay
            key={item.id}
            data={item}
            compact
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-badge border-2 border-rust bg-rust px-3 py-1 font-cond text-badge font-bold uppercase tracking-caps-tight text-paper"
      >
        {chosen ? `Change — ${chosen}` : 'Choose a Weapons System…'}
      </button>
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
