/**
 * Dashboard — the play surface for one pilot, with their assigned mech and
 * crawler (docs/architecture/dashboard.md).
 *
 * It is keyed on the pilot (ADR-038 §1), and the pilot's seat in its Game
 * (`useSeat`) says whether they are on foot or boarded, and in which mech. A
 * boarded pilot runs the mech the seat names, which need not be the one
 * assigned to them; on foot, the mech shown is the assigned one
 * (`mech-to-pilot`), which Board climbs into. The crawler is the pilot's own
 * (`pilot-to-crawler`). Both links resolve through the sheet's
 * `resolveSheetComposition`. Whether this pilot may be played at all is
 * `DashboardGate`'s question, asked before this renders.
 */

import { buttonVariants } from 'component-lib'
// The dashboard's `.pc-*` stylesheet. component-lib's dashboard components
// import no CSS themselves — that rode the barrel into srd (audit PK-01) — so
// the one app that renders a dashboard loads it here, and it lands in this
// route's chunk rather than in every page's stylesheet.
import 'component-lib/styles/dashboard.css'
import { useCallback, useMemo } from 'react'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { containerOf } from '../../lib/container'
import type { CockpitPrefs } from '../../lib/schemas/cockpitPrefs'
import { parseContainer, serializeContainer } from '../../stores/activeContainerStore'
import { setCockpitPrefs, useCockpitPrefs } from '../../stores/cockpitPrefsStore'
import { useEntityStore } from '../../stores/entityStore'
import { usePlayStateStore } from '../../stores/playStateStore'
import { AppLink } from '../shared/AppLink'
import type { EntityLookup } from '../sheet/composition'
import { resolveSheetComposition } from '../sheet/composition'
import { ActiveItemBand } from './ActiveItemBand'
import { DashboardCanvas } from './DashboardCanvas'
import { DashboardGrid } from './DashboardGrid'
import { Dial } from './Dial'
import { DialConfig } from './DialConfig'
import { DisplayPanel } from './DisplayPanel'
import { DowntimeWizard } from './DowntimeWizard'
import { applyDialPrefs, configurableKinds, dialItems } from './dialItems'
import { RailBar } from './RailBar'
import type { MountState, SeatHandle } from './useSeat'
import { NO_SEAT, useSeat } from './useSeat'

export function Dashboard({ pilotId }: { pilotId: string }) {
  // A build with no Convex mounts no provider, so `useSeat` would throw. The
  // gate never opens the Dashboard in one, but tests and stories render it.
  if (!isConvexConfigured) return <DashboardView pilotId={pilotId} seat={NO_SEAT} />
  return <SeatedDashboard pilotId={pilotId} />
}

function SeatedDashboard({ pilotId }: { pilotId: string }) {
  const pilot = useEntityStore((s) => s.get('pilot', pilotId))
  return <DashboardView pilotId={pilotId} seat={useSeat(pilot)} />
}

function DashboardView({ pilotId, seat }: { pilotId: string; seat: SeatHandle }) {
  const storeState = useEntityStore()
  const inDowntime = usePlayStateStore((s) => s.downtime)
  const wheel = usePlayStateStore((s) => s.wheel)
  const setWheel = usePlayStateStore((s) => s.setWheel)
  const leaveDowntime = usePlayStateStore((s) => s.leaveDowntime)
  const pilot = storeState.get('pilot', pilotId)

  // Persisted dial prefs are scoped to the pilot's container (ADR-030 §2) and
  // kept in localStorage — see cockpitPrefsStore for why neither container is
  // the right record to hang them off. Hooks run unconditionally, before the
  // early returns, so `containerOf` is fed a stand-in when there is no pilot
  // yet; nothing reads those prefs in that state.
  //
  // `containerOf` mints a fresh object every render, so it is round-tripped
  // through its serialized form to get a value that is stable while the pilot's
  // container is — otherwise `setPrefs` would change identity on every render
  // and defeat every memo below it.
  const containerKey = serializeContainer(containerOf(pilot ?? {}))
  const container = useMemo(() => parseContainer(containerKey), [containerKey])
  const prefs = useCockpitPrefs(container)
  const setPrefs = useCallback(
    (next: CockpitPrefs) => {
      setCockpitPrefs(container, next)
    },
    [container]
  )

  const lookup: EntityLookup = {
    get: (type, entityId) => storeState.get(type, entityId),
  }
  const composition = resolveSheetComposition({
    kind: 'pilot',
    id: pilotId,
    links: storeState.softLinks,
    store: lookup,
  })
  const boardedId = seat.seat.mount.kind === 'boarded' ? seat.seat.mount.mechId : null
  const boarded = boardedId === null ? null : storeState.get('mech', boardedId)
  const mech = boarded ?? composition.mech
  const crawler = composition.crawler
  // The active-row entity drives the whole-canvas tint (proposed ADR-018).
  const mount: MountState = inDowntime ? 'downtime' : boarded ? 'mech' : 'pilot'

  // The instruments are built around a mech; a pilot with none assigned and
  // none boarded is given one on their sheet.
  if (!pilot || !mech) {
    return (
      <DashboardCanvas>
        <DashboardGrid
          rail={<span>{pilot ? `Pilot · ${pilot.name}` : 'Pilot not found'}</span>}
          primary={
            <div className="pc-placeholder">
              {pilot
                ? `${pilot.name} has no assigned mech. Assign one on their sheet to play.`
                : `No pilot with id “${pilotId}”.`}
            </div>
          }
          display={<div className="pc-fill">—</div>}
          wheel={<div className="pc-placeholder">Dial</div>}
        />
      </DashboardCanvas>
    )
  }

  const isDowntime = mount === 'downtime'
  const onFoot = mount === 'pilot'
  // Downtime is crawler-dominant: rail, stamp, and Active Item all follow the
  // crawler ontology (pink); otherwise the boarded mech / pilot on foot.
  const fam = isDowntime ? 'crawler' : onFoot ? 'pilot' : 'mech'
  const railTitle = isDowntime
    ? crawler
      ? `Downtime · ${crawler.name}`
      : 'Downtime'
    : onFoot
      ? `Pilot · ${pilot.name}`
      : `Mech · ${mech.name}`

  // The Dial holds the non-active entities + statless views; the item in the
  // active slot is the display's focus (focus→display sync; content is Phase 4).
  // Persisted prefs (show/hide + order) are applied on top of the base list.
  const items = applyDialPrefs(dialItems({ mount, mech, pilot, crawler }), prefs)
  const cfgKinds = configurableKinds({ pilot, crawler })
  const focus =
    items.length > 0 ? items[((wheel % items.length) + items.length) % items.length] : undefined

  return (
    <DashboardCanvas>
      <DashboardGrid
        mount={mount}
        rail={
          <RailBar
            title={railTitle}
            fam={fam}
            returnControl={
              <AppLink
                href="/"
                className={buttonVariants({
                  surface: 'instrument',
                  variant: 'ghost',
                  size: 'compact',
                })}
              >
                ◄ Return to Roster
              </AppLink>
            }
            onLeaveDowntime={isDowntime ? leaveDowntime : undefined}
          />
        }
        primary={
          <ActiveItemBand
            mech={mech}
            pilot={pilot}
            crawler={crawler}
            mount={mount}
            seat={seat}
            store={storeState}
          />
        }
        display={
          isDowntime ? (
            <DowntimeWizard crawler={crawler} mech={mech} pilot={pilot} />
          ) : (
            <DisplayPanel
              focus={focus}
              mech={mech}
              pilot={pilot}
              crawler={crawler}
              mount={mount}
              seat={seat}
            />
          )
        }
        wheel={
          <Dial
            items={items}
            activeIndex={wheel}
            onActiveIndexChange={setWheel}
            renderConfig={(close) => (
              <DialConfig kinds={cfgKinds} prefs={prefs} onChange={setPrefs} onClose={close} />
            )}
          />
        }
      />
    </DashboardCanvas>
  )
}
