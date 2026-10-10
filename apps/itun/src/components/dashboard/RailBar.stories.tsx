import { buttonVariants } from 'component-lib'
import { Caption } from 'component-lib/stories/harness'
import { ChevronLeft } from 'lucide-react'
import { InstrumentStage } from './_dashboardStage'
import { RailBar } from './RailBar'
import { RailUnit } from './RailUnit'

export default { title: 'Compositions/Dashboard/Rail Bar' }

/** Stand-in for the app's router link back to the Game (an AppLink in production). */
const BackLink = (
  <a
    href="#game"
    aria-label="Back to Reclamation of the Wastes"
    className={buttonVariants({ surface: 'instrument', variant: 'ghost', size: 'iconOnly' })}
  >
    <ChevronLeft size={18} aria-hidden="true" />
  </a>
)

/**
 * The top rail across the three mount states (boards D1–D3, issue 1255): the
 * pilot's name, a stamp for where they are, the Game, and the save state. In
 * Downtime the pilot and mech ride the rail as compact links with their pips,
 * because the crawler has the whole unit row.
 */
export const Default = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Top rail — boarded, on foot (the Mediator's Start), Downtime (the Mediator's End).
    </Caption>
    <InstrumentStage width={1260}>
      <div className="flex flex-col gap-3">
        <div className="pc-rail">
          <RailBar
            name="Bonesaw"
            stamp="Boarded · Scrapper"
            fam="mech"
            context="Game · Reclamation of the Wastes"
            returnControl={BackLink}
            status={<span>Saved</span>}
          />
        </div>
        <div className="pc-rail">
          <RailBar
            name="Bonesaw"
            stamp="On foot"
            fam="pilot"
            context="Game · Reclamation of the Wastes"
            returnControl={BackLink}
            status={<span>Saved</span>}
            downtimeAction={{
              label: 'Start Downtime ▶',
              title: 'Start Downtime for the whole table',
              onClick: () => {},
            }}
          />
        </div>
        <div className="pc-rail">
          <RailBar
            name="Bonesaw"
            stamp="Downtime · Step 3 of 10"
            fam="crawler"
            context="Run by the Mediator"
            returnControl={BackLink}
            units={
              <>
                <RailUnit
                  kind="pilot"
                  label="Pilot"
                  readings={[
                    { label: 'HP', value: 8, max: 10, pips: true },
                    { label: 'TP', value: 1 },
                  ]}
                  onOpen={() => {}}
                />
                <RailUnit
                  kind="mech"
                  label="Scrapper"
                  readings={[
                    { label: 'SP', value: 9, max: 9, pips: true },
                    { label: 'EP', value: 9, max: 9 },
                    { label: 'Heat', value: 0, max: 8 },
                  ]}
                  onOpen={() => {}}
                />
              </>
            }
            status={<span>Saved</span>}
          />
        </div>
      </div>
    </InstrumentStage>
  </div>
)
