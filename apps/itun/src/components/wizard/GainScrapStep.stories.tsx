import { Caption } from 'component-lib/stories/harness'
import { GainScrapStep } from './GainScrapStep'

export default {
  title: 'Compositions/Wizard/Gain Scrap Step',
}

/** The starting-scrap explainer step. */
export const Default = () => (
  <div className="sheet--crawler bg-paper p-4">
    <Caption>GainScrapStep</Caption>
    <GainScrapStep />
  </div>
)
