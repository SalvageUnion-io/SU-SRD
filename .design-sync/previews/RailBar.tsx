/* Ported from packages/component-lib/src/components/dashboard/RailBar.stories.tsx. */
import { buttonVariants, RailBar } from 'component-lib'
import { Caption, InstrumentStage } from '../preview-lib/harness'

// Stand-in for the app's router return link — an AppLink styled via
// `buttonVariants` in production.
const ReturnLink = (
  <a
    href="#dashboard"
    className={buttonVariants({ surface: 'instrument', variant: 'ghost', size: 'compact' })}
  >
    ◄ Return to Workspace
  </a>
)

/**
 * The top rail across the three mount states. Presentational — the app supplies
 * the return link. The entity stamp is ontology-toned (mech green / pilot orange
 * / crawler pink), and the right-hand action is Settings, or Leave Downtime
 * while in downtime.
 */
export function MountStates() {
  return (
    <div className="flex flex-col gap-4">
      <Caption>mech (boarded), pilot (on foot), crawler (downtime)</Caption>
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
}
