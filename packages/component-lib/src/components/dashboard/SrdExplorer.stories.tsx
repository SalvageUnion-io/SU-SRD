import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { InstrumentStage } from '../../stories/_dashboardStage'
import { SrdExplorer } from './SrdExplorer'

export default { title: 'Compositions/Dashboard/SRD Explorer' }

/**
 * The SRD Explorer display focus: a search box + 8 category tiles that drill
 * into the faithful ReferenceEntityCard in-panel. Self-loads the reference
 * ORM. Rendered here as the light "document under glass" inside the dark
 * instrument stage, exactly as it sits in the live Dashboard display.
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>SRD Explorer — search + category tiles → in-panel reference cards.</Caption>
    <InstrumentStage width={560}>
      <div
        className="pc-display-light"
        style={{ height: 480, borderRadius: 'var(--radius-panel)' }}
      >
        <SrdExplorer />
      </div>
    </InstrumentStage>
  </div>
)
