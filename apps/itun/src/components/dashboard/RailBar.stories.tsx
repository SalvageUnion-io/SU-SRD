import { buttonVariants } from 'component-lib'
import { Caption } from 'component-lib/stories/harness'
import { InstrumentStage } from './_dashboardStage'
import { RailBar } from './RailBar'

export default { title: 'Compositions/Dashboard/Rail Bar' }

/** Stand-in for the app's router return link (an AppLink styled via
 * `buttonVariants` in production). */
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
 * the return link; the entity stamp is ontology-toned (mech green / pilot orange
 * / crawler pink), and the right action is Settings for a player, or the
 * Mediator's Start or End Downtime.
 */
export const Default = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Top rail — mech (boarded), pilot (on foot, the Mediator's Start), crawler (downtime, the
      Mediator's End).
    </Caption>
    <InstrumentStage width={560}>
      <div className="flex flex-col gap-3">
        <div className="pc-rail">
          <RailBar title="Mech · Iron Mongrel" fam="mech" returnControl={ReturnLink} />
        </div>
        <div className="pc-rail">
          <RailBar
            title="Pilot · Vesna Kroll"
            fam="pilot"
            returnControl={ReturnLink}
            downtimeAction={{
              label: 'Start Downtime ▶',
              title: 'Start Downtime for the whole table',
              onClick: () => {},
            }}
          />
        </div>
        <div className="pc-rail">
          <RailBar
            title="Downtime · The Kettle"
            fam="crawler"
            returnControl={ReturnLink}
            downtimeAction={{
              label: '■ End Downtime',
              title: 'End Downtime; everyone returns to their seat',
              onClick: () => {},
            }}
          />
        </div>
      </div>
    </InstrumentStage>
  </div>
)
