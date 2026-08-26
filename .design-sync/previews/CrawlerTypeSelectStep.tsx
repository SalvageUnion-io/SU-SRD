/* Ported from packages/component-lib/src/components/wizard/CrawlerTypeStep.stories.tsx. */
import { CrawlerTypeSelectStep } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

/**
 * The whole step — the radio pool of crawler types plus the selected type's
 * full card beneath it.
 */
export function PickType() {
  const types = SalvageUnionReference.Crawlers.all()
  return (
    <div className="sheet--crawler bg-paper p-4">
      <Caption>the first type selected</Caption>
      <CrawlerTypeSelectStep
        types={types}
        selectedType={types[0]?.id ?? null}
        onSelect={() => {}}
      />
    </div>
  )
}

/** Nothing chosen yet — the pool with no detail card. */
export function Unselected() {
  const types = SalvageUnionReference.Crawlers.all()
  return (
    <div className="sheet--crawler bg-paper p-4">
      <Caption>no type chosen yet</Caption>
      <CrawlerTypeSelectStep types={types} selectedType={null} onSelect={() => {}} />
    </div>
  )
}
