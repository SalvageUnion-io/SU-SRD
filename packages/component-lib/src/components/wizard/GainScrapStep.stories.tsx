import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { GainScrapStep } from './GainScrapStep'

export default {
  title: 'Compositions/Wizard/Gain Scrap Step',
}

/** The starting-scrap explainer step. */
export const Default: Story = () => (
  <div className="sheet--crawler bg-paper p-4">
    <Caption>GainScrapStep</Caption>
    <GainScrapStep />
  </div>
)
