/*
 * No story file — `CardRemoveButton` is demonstrated through the cards it rides.
 * Composed from its props contract and its real call site: the ✕ affordance on
 * an installed entity card.
 */
import { CardRemoveButton, ReferenceEntityCard } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption, Row } from '../preview-lib/harness'

/**
 * The card ✕. `name` is the entity it removes, and it exists to build the
 * accessible label ("Remove …") — the glyph alone would announce nothing.
 */
export function Standalone() {
  const systems = SalvageUnionReference.Systems.all().slice(0, 3)
  return (
    <div className="bg-paper p-4">
      <Caption>one per removable entity</Caption>
      <Row>
        {systems.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-2 border-chrome border-ink bg-paper px-3 py-1.5"
          >
            <span className="font-body text-sm text-ink">{s.name}</span>
            <CardRemoveButton name={s.name} onRemove={() => {}} />
          </span>
        ))}
      </Row>
    </div>
  )
}

/** On the card it belongs to — the top-right corner of an installed system. */
export function OnCard() {
  const system = SalvageUnionReference.Systems.all()[0]
  if (!system) return null
  return (
    <div className="max-w-md bg-paper p-4">
      <Caption>riding an installed card</Caption>
      <div className="relative">
        <ReferenceEntityCard data={system} size="medium" extent="head" />
        <span className="absolute right-2 top-2">
          <CardRemoveButton name={system.name} onRemove={() => {}} />
        </span>
      </div>
    </div>
  )
}
