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
 *
 * The top row is the `SlotRow`: one Major slot and two Minors, placed by the
 * mount (docs/architecture/dashboard-redesign.md D1). ⤢ on a Minor opens that
 * entity's Major over the display (`SlotOverlay`) without moving the slots.
 */

import { buttonVariants } from 'component-lib'
// The dashboard's `.pc-*` stylesheet. component-lib's dashboard components
// import no CSS themselves — that rode the barrel into srd (audit PK-01) — so
// the one app that renders a dashboard loads it here, and it lands in this
// route's chunk rather than in every page's stylesheet.
import 'component-lib/styles/dashboard.css'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { useEntityStore } from '../../stores/entityStore'
import { usePlayStateStore } from '../../stores/playStateStore'
import { AppLink } from '../shared/AppLink'
import type { EntityLookup } from '../sheet/composition'
import { resolveSheetComposition } from '../sheet/composition'
import { DashboardCanvas } from './DashboardCanvas'
import { DashboardGrid } from './DashboardGrid'
import type { DisplayFocus } from './DisplayPanel'
import { DisplayPanel, DisplayPicker } from './DisplayPanel'
import { DowntimeWizard } from './DowntimeWizard'
import { RailBar } from './RailBar'
import { SlotOverlay } from './SlotOverlay'
import { SlotMajor, SlotRow } from './SlotRow'
import type { SlotKind } from './slotLayout'
import type { MountState, SeatHandle } from './useSeat'
import { NO_SEAT, useSeat } from './useSeat'

type DashboardProps = {
  pilotId: string
  /**
   * The viewer is the Mediator of the pilot's Game, who alone runs the crawler
   * (plan D11). `DashboardGate` reads it from `games.get`.
   */
  mediator?: boolean
}

export function Dashboard({ pilotId, mediator = false }: DashboardProps) {
  // A build with no Convex mounts no provider, so `useSeat` would throw. The
  // gate never opens the Dashboard in one, but tests and stories render it.
  if (!isConvexConfigured) {
    return <DashboardView pilotId={pilotId} seat={NO_SEAT} mediator={mediator} />
  }
  return <SeatedDashboard pilotId={pilotId} mediator={mediator} />
}

function SeatedDashboard({ pilotId, mediator }: { pilotId: string; mediator: boolean }) {
  const pilot = useEntityStore((s) => s.get('pilot', pilotId))
  return <DashboardView pilotId={pilotId} seat={useSeat(pilot)} mediator={mediator} />
}

const SLOT_LABEL: Record<SlotKind, string> = { pilot: 'Pilot', mech: 'Mech', crawler: 'Crawler' }

/** The display stacks the picker over the panel; the ⤢ overlay covers both. */
const DISPLAY: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
}

const DISPLAY_BODY: CSSProperties = { flex: 1, minHeight: 0 }

/** The Major a ⤢ opened, and the ⤢ to hand focus back to. */
type Expanded = { kind: SlotKind; trigger: HTMLButtonElement }

function DashboardView({
  pilotId,
  seat,
  mediator,
}: {
  pilotId: string
  seat: SeatHandle
  mediator: boolean
}) {
  const storeState = useEntityStore()
  const inDowntime = usePlayStateStore((s) => s.downtime)
  const leaveDowntime = usePlayStateStore((s) => s.leaveDowntime)
  // Screen arrangement stays on the device and resets with the page (D7).
  const [focus, setFocus] = useState<DisplayFocus>('actions')
  const [expanded, setExpanded] = useState<Expanded | null>(null)
  const pilot = storeState.get('pilot', pilotId)

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
  // The Major-slot entity drives the whole-canvas tint (proposed ADR-018).
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
        />
      </DashboardCanvas>
    )
  }

  const isDowntime = mount === 'downtime'
  const onFoot = mount === 'pilot'
  // Downtime is crawler-dominant: the rail and the Major follow the crawler
  // ontology (pink); otherwise the boarded mech / pilot on foot.
  const fam = isDowntime ? 'crawler' : onFoot ? 'pilot' : 'mech'
  const railTitle = isDowntime
    ? crawler
      ? `Downtime · ${crawler.name}`
      : 'Downtime'
    : onFoot
      ? `Pilot · ${pilot.name}`
      : `Mech · ${mech.name}`

  const slots = {
    mech,
    pilot,
    crawler,
    boarded: boarded !== null,
    seat,
    mediator,
    store: storeState,
  }
  const pickable: { focus: DisplayFocus; label: string }[] = [
    { focus: 'actions', label: 'Actions' },
    { focus: 'pilot', label: 'Pilot' },
    { focus: 'mech', label: 'Mech' },
    ...(crawler ? [{ focus: 'crawler' as const, label: 'Crawler' }] : []),
    { focus: 'tables', label: 'Tables' },
    { focus: 'srd', label: 'SRD' },
  ]
  const shown: DisplayFocus = pickable.some((p) => p.focus === focus) ? focus : 'actions'
  const expandedName =
    expanded === null
      ? ''
      : expanded.kind === 'pilot'
        ? pilot.name
        : expanded.kind === 'mech'
          ? mech.name
          : (crawler?.name ?? '')

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
          <SlotRow
            {...slots}
            mount={mount}
            onExpand={(kind, trigger) => setExpanded({ kind, trigger })}
          />
        }
        display={
          <div style={DISPLAY}>
            {isDowntime ? (
              <DowntimeWizard crawler={crawler} mech={mech} pilot={pilot} />
            ) : (
              <>
                <DisplayPicker focus={shown} options={pickable} onFocus={setFocus} />
                <div style={DISPLAY_BODY}>
                  <DisplayPanel
                    focus={shown}
                    mech={mech}
                    pilot={pilot}
                    crawler={crawler}
                    mount={mount}
                    seat={seat}
                  />
                </div>
              </>
            )}
            {expanded ? (
              <SlotOverlay
                title={`${SLOT_LABEL[expanded.kind]} · ${expandedName}`}
                returnFocusTo={expanded.trigger}
                onClose={() => setExpanded(null)}
              >
                <SlotMajor
                  {...slots}
                  kind={expanded.kind}
                  mount={mount}
                  hostsDamagePrompt={false}
                />
              </SlotOverlay>
            ) : null}
          </div>
        }
      />
    </DashboardCanvas>
  )
}
