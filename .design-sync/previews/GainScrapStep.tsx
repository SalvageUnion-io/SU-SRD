/* Ported from packages/component-lib/src/components/wizard/GainScrapStep.stories.tsx. */
import { GainScrapStep } from 'component-lib'
import { Caption } from '../preview-lib/harness'

/**
 * The starting-scrap explainer step. It takes no props — it is a fixed piece of
 * rules copy in the crawler creation flow.
 */
export function Explainer() {
  return (
    <div className="sheet--crawler bg-paper p-4">
      <Caption>starting scrap</Caption>
      <GainScrapStep />
    </div>
  )
}
