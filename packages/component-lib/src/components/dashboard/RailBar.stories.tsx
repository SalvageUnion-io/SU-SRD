import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { InstrumentStage } from '../../stories/_dashboardStage'
import { RailBar } from './RailBar'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Dashboard/RailBar' }

/** Stand-in for the app's router return link (an AppLink in production). */
const ReturnLink = (
  <button type="button" className="pc-railbtn">
    ◄ Return to Workspace
  </button>
)

/**
 * The top rail across the three mount states. Presentational — the app supplies
 * the return link; the entity stamp is ontology-toned (mech green / pilot orange
 * / crawler pink), and the right action is Settings, or Leave Downtime in
 * downtime.
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>Top rail — mech (boarded), pilot (on foot), crawler (downtime).</Caption>
    <InstrumentStage width={560}>
      <div className="flex flex-col gap-3">
        <div className="pc-rail">
          <RailBar title="Mech · Iron Mongrel" fam="mech" returnControl={ReturnLink} />
        </div>
        <div className="pc-rail">
          <RailBar title="Pilot · Vesna Kroll" fam="pilot" returnControl={ReturnLink} />
        </div>
        <div className="pc-rail">
          <RailBar
            title="Downtime · The Kettle"
            fam="crawler"
            returnControl={ReturnLink}
            onLeaveDowntime={() => {}}
          />
        </div>
      </div>
    </InstrumentStage>
  </div>
)
