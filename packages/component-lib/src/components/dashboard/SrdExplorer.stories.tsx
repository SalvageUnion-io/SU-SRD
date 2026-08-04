import type { Story } from '@ladle/react'
import { InstrumentStage } from '../../stories/_dashboardStage'
import { Caption } from '../../stories/_harness'
import { SrdExplorer } from './SrdExplorer'

export default { title: 'Compositions/Dashboard/SRD Explorer' }

/**
 * The SRD Explorer display focus: the srd landing page's catalog minus the site
 * header — the same category sections and `CatalogTile`s from
 * `buildCatalogSections()`, plus the header's search — with tiles drilling into
 * the faithful ReferenceEntityCard in-panel instead of navigating. Self-loads
 * the reference ORM. Rendered here as the light "document under glass" inside
 * the dark instrument stage, exactly as it sits in the live Dashboard display.
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>SRD Explorer — search + the SRD catalog → in-panel reference cards.</Caption>
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
