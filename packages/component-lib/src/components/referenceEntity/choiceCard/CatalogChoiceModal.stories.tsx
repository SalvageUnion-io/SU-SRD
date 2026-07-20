import type { Story } from '@ladle/react'
import { useState } from 'react'
import { getChoices, SalvageUnionReference, type SURefEntity } from 'salvageunion-reference'
import { resolveCatalogChoiceEntities } from 'salvageunion-reference/rules'
import { Caption } from '../../../stories/_harness'
import { Button } from '../../chrome/Button'
import { ReferenceEntityCard } from '../card/ReferenceEntityCard'
import { CatalogChoiceModal } from './CatalogChoiceModal'
import type { ChoiceSelections } from './choiceSelectionHelpers'

/**
 * CatalogChoiceModal — the single-select picker for a SCHEMA-ONLY catalog
 * choice ("pick any entity from the collection"), as launched from the entity
 * card's Choose… button. The fixture is the real Armament Bay's Weapons System
 * choice (any Mech System dealing SP damage).
 */
// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Entity/Catalog Choice Modal',
}

const bay = SalvageUnionReference.CrawlerBays.all().find((b) => b.name === 'Armament Bay')
const choice = bay ? (getChoices(bay) ?? [])[0] : undefined

/** The editable card flow: Choose… button → modal pick → the chosen entity as a real listing card. */
function PickerDemo({ techLevel }: { techLevel?: number }) {
  const [open, setOpen] = useState(false)
  const [selections, setSelections] = useState<ChoiceSelections>({})
  if (!choice) return <Caption>Armament Bay fixture missing.</Caption>
  const chosen = selections[choice.id]?.[0]
  // Mirror the card: resolve the pick back to its entity and show it as a
  // listing card, so the selection reads like every other entity on the sheet.
  const chosenEntity = chosen
    ? (resolveCatalogChoiceEntities(
        choice,
        typeof techLevel === 'number' ? { techLevel } : undefined
      ).find((e) => e.name === chosen) as unknown as SURefEntity | undefined)
    : undefined
  return (
    <div className="flex w-full max-w-md flex-col items-start gap-1.5">
      {chosenEntity && <ReferenceEntityCard data={chosenEntity} size="medium" extent="head" />}
      <Button variant="primary" size="xs" onClick={() => setOpen(true)}>
        {chosen ? `Change — ${chosen}` : `Choose ${choice.name}…`}
      </Button>
      <CatalogChoiceModal
        open={open}
        onClose={() => setOpen(false)}
        choice={choice}
        techLevel={techLevel}
        selected={selections[choice.id] ?? []}
        onSelect={(values) => setSelections((s) => ({ ...s, [choice.id]: values }))}
      />
    </div>
  )
}

export const Default: Story = () => (
  <div className="flex flex-col gap-3">
    <Caption>
      Armament Bay · Weapons System — single-select; picking replaces the prior pick, re-picking the
      chosen one clears it.
    </Caption>
    <PickerDemo />
  </div>
)

/** The crawler's Tech Level caps the pool — TL 2 here narrows the searcher's facets and entities. */
export const TechLevelCapped: Story = () => (
  <div className="flex flex-col gap-3">
    <Caption>techLevel=2 — the pool and its facets narrow to TL 2 and below.</Caption>
    <PickerDemo techLevel={2} />
  </div>
)
