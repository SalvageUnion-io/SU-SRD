import type { CSSProperties } from 'react'
import { useState } from 'react'
import { getChoices, SalvageUnionReference } from 'salvageunion-reference'
import { resolveCatalogChoiceEntities } from 'salvageunion-reference/rules'
import { space } from '../../../design/tokens'
import type { Story } from '../../../stories/_harness'
import { Caption } from '../../../stories/_harness'
import { Button } from '../../atoms/Button'
import { ReferenceEntityCard } from '../card/ReferenceEntityCard'
import { CatalogChoiceModal } from './CatalogChoiceModal'
import type { ChoiceSelections } from './choiceSelectionHelpers'

/**
 * CatalogChoiceModal — the single-select picker for a SCHEMA-ONLY catalog
 * choice ("pick any entity from the collection"), as launched from the entity
 * card's Choose… button. The fixture is the real Armament Bay's Weapons System
 * choice (any Mech System dealing SP damage).
 */
export default {
  title: 'Compositions/Entity/Catalog Choice Modal',
}

const bay = SalvageUnionReference.CrawlerBays.getByName('Armament Bay')
const choice = bay ? (getChoices(bay) ?? [])[0] : undefined

const demoStyle = {
  display: 'flex',
  width: '100%',
  maxWidth: '28rem',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: space[6],
} satisfies CSSProperties

const pageStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
} satisfies CSSProperties

/** The editable card flow: Choose… button → modal pick → the chosen entity as a real listing card. */
function PickerDemo({ techLevel }: { techLevel?: number }) {
  const [open, setOpen] = useState(false)
  const [selections, setSelections] = useState<ChoiceSelections>({})
  if (!choice) return <Caption>Armament Bay fixture missing.</Caption>
  const chosen = selections[choice.id]?.[0]
  // Mirror the card: resolve the pick back to its entity and show it as a
  // listing card, so the selection reads like every other entity on the sheet.
  const chosenEntity = chosen
    ? resolveCatalogChoiceEntities(
        choice,
        typeof techLevel === 'number' ? { techLevel } : undefined
      ).find((e) => e.name === chosen)
    : undefined
  return (
    <div style={demoStyle}>
      {chosenEntity && <ReferenceEntityCard data={chosenEntity} size="medium" extent="head" />}
      <Button variant="primary" size="mini" onClick={() => setOpen(true)}>
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
  <div style={pageStyle}>
    <Caption>
      Armament Bay · Weapons System — single-select; picking replaces the prior pick, re-picking the
      chosen one clears it.
    </Caption>
    <PickerDemo />
  </div>
)

/** The crawler's Tech Level caps the pool — TL 2 here narrows the searcher's facets and entities. */
export const TechLevelCapped: Story = () => (
  <div style={pageStyle}>
    <Caption>techLevel=2 — the pool and its facets narrow to TL 2 and below.</Caption>
    <PickerDemo techLevel={2} />
  </div>
)
