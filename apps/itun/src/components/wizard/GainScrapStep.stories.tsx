import { tokens } from 'component-lib'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { GainScrapStep } from './GainScrapStep'

const FRAME: CSSProperties = { backgroundColor: tokens.color.paper, padding: tokens.space[16] }

export default {
  title: 'Compositions/Wizard/Gain Scrap Step',
}

/** The starting-scrap explainer step. */
export const Default = () => (
  <div className="sheet--crawler" style={FRAME}>
    <Caption>GainScrapStep</Caption>
    <GainScrapStep />
  </div>
)
