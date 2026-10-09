/**
 * Dashboard — the play surface for one pilot, with their assigned mech and
 * crawler (docs/architecture/dashboard.md).
 *
 * It is keyed on the pilot (ADR-038 §1), and the pilot's seat in its Game
 * (`useSeat`) says whether they are on foot or boarded, and in which mech. A
 * boarded pilot runs the mech the seat names, which need not be the one
 * assigned to them; on foot, the mech shown is the assigned one
 * (`mech-to-pilot`), which the main half of Board climbs into. The crawler is
 * the pilot's own (`pilot-to-crawler`). Both links resolve through the sheet's
 * `resolveSheetComposition`. A pilot with no assigned mech still plays on
 * foot, and boards one from the Board menu (`BoardControl`, plan D4), which
 * reads the rest of the Game's mechs through `useBoardSources`. Whether this
 * pilot may be played at all is `DashboardGate`'s question, asked before this
 * renders.
 *
 * The top row is the `SlotRow`: one Major slot and two Minors, placed by the
 * mount (docs/architecture/dashboard-redesign.md D1). ⤢ on a Minor opens that
 * entity's Major over the display (`SlotOverlay`) without moving the slots.
 *
 * Downtime is the Game's (D8): its `downtime` row, read through
 * `useDowntime`. While a step is running the Crawler is Major and the step
 * guide (`DowntimeWizard`) replaces the deck, on every member's Dashboard at
 * once; when it ends, each player is back wherever their seat says. The
 * Mediator starts and ends it from the rail and moves it on from the guide
 * (plan §8 A1); everyone marks their own step done.
 *
 * Below it, the deck (`DeckList`) sits beside the display's tabs
 * (`DisplayTabs`, D5): an action chosen from the deck opens in the Resolve
 * tab, and its progress is saved on the seat (`useActionsDeck`). A strip along
 * the bottom carries the Mediator's latest alert and the proposal count, and
 * the rail says whether play is being saved. What the rest of the table is
 * doing — the Game's rolls, alerts and the crew's derived status — is
 * `useGameFeed`'s.
 * Only the screen's arrangement stays on the device (D7): the open tab, the
 * Reference tab's entity, the deck's filters and the ⤢ overlay. So does the
 * deck's one-shot hand-off of a destructive outcome to the Major's Take Damage
 * overlay, which is component state here.
 */

import { buttonVariants } from 'component-lib'
// The dashboard's `.pc-*` stylesheet. component-lib's dashboard components
// import no CSS themselves — that rode the barrel into srd (audit PK-01) — so
// the one app that renders a dashboard loads it here, and it lands in this
// route's chunk rather than in every page's stylesheet.
import '../../styles/dashboard.css'
import { borderWidth, color } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { isUpkeepStep } from '../../lib/rules/downtime'
import { useEntityStore } from '../../stores/entityStore'
import { AppLink } from '../shared/AppLink'
import type { EntityLookup } from '../sheet/composition'
import { resolveSheetComposition } from '../sheet/composition'
import type { BoardSources } from './boardMenu'
import { boardMenu, NO_BOARD_SOURCES } from './boardMenu'
import { CrewTab } from './CrewTab'
import { DashboardCanvas } from './DashboardCanvas'
import { DashboardGrid } from './DashboardGrid'
import { DashboardStrip } from './DashboardStrip'
import { DeckList } from './DeckList'
import type { ReferenceFocus } from './DisplayPanel'
import { DisplayPanel, DisplayPicker } from './DisplayPanel'
import type { DisplayTab } from './DisplayTabs'
import { DisplayTabs } from './DisplayTabs'
import { DowntimeWizard } from './DowntimeWizard'
import { LogTab } from './LogTab'
import { RailBar } from './RailBar'
import { ResolvePanel } from './ResolvePanel'
import { SavedIndicator } from './SavedIndicator'
import { SlotOverlay } from './SlotOverlay'
import { SlotMajor, SlotRow } from './SlotRow'
import type { SlotKind } from './slotLayout'
import { useActionsDeck } from './useActionsDeck'
import { useBoardSources } from './useBoardSources'
import type { DowntimeHandle } from './useDowntime'
import { NO_DOWNTIME, useDowntime } from './useDowntime'
import type { GameFeed } from './useGameFeed'
import { crewLines, NO_GAME_FEED, useGameFeed } from './useGameFeed'
import type { MountState, SeatHandle } from './useSeat'
import { NO_SEAT, useSeat } from './useSeat'

type DashboardProps = {
  pilotId: string
  /**
   * The viewer is the Mediator of the pilot's Game, who alone runs the crawler
   * (plan D11) and Downtime (D8). `DashboardGate` reads it from `games.get`,
   * the membership's own flag.
   */
  mediator?: boolean
}

export function Dashboard({ pilotId, mediator = false }: DashboardProps) {
  // A build with no Convex mounts no provider, so `useSeat` would throw. The
  // gate never opens the Dashboard in one, but tests and stories render it.
  if (!isConvexConfigured) {
    return (
      <DashboardView
        pilotId={pilotId}
        seat={NO_SEAT}
        sources={NO_BOARD_SOURCES}
        feed={NO_GAME_FEED}
        downtime={NO_DOWNTIME}
        mediator={mediator}
      />
    )
  }
  return <SeatedDashboard pilotId={pilotId} mediator={mediator} />
}

function SeatedDashboard({ pilotId, mediator }: { pilotId: string; mediator: boolean }) {
  const pilot = useEntityStore((s) => s.get('pilot', pilotId))
  return (
    <DashboardView
      pilotId={pilotId}
      seat={useSeat(pilot)}
      sources={useBoardSources(pilot)}
      feed={useGameFeed(pilot)}
      downtime={useDowntime(pilot)}
      mediator={mediator}
    />
  )
}

const SLOT_LABEL: Record<SlotKind, string> = { pilot: 'Pilot', mech: 'Mech', crawler: 'Crawler' }

/**
 * The display region: the deck beside the tabs, over the strip. The ⤢ overlay
 * covers all of it.
 */
const DISPLAY: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
}

/**
 * Deck and tabs side by side, the deck a little wider (its tiles pack in
 * columns). The one row is pinned to the region's height, not its content's,
 * so each side scrolls inside itself rather than pushing the strip off the
 * canvas.
 */
const DECK_AND_TABS: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)',
  gridTemplateRows: 'minmax(0, 1fr)',
}

const DECK: CSSProperties = {
  minHeight: 0,
  borderRight: `${borderWidth.chrome} solid ${color.ink20}`,
}

/** The Reference tab: its entity picker over the card. */
const REFERENCE: CSSProperties = {
  height: '100%',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
}

const DISPLAY_BODY: CSSProperties = { flex: 1, minHeight: 0 }

/** The Major a ⤢ opened, and the ⤢ to hand focus back to. */
type Expanded = { kind: SlotKind; trigger: HTMLButtonElement }

function DashboardView({
  pilotId,
  seat,
  sources,
  feed,
  downtime,
  mediator,
}: {
  pilotId: string
  seat: SeatHandle
  /** What the Board menu and the Crew tab read from the Game (`useBoardSources`). */
  sources: BoardSources
  /** The rest of the table: rolls, alerts, the inbox, the crew (`useGameFeed`). */
  feed: GameFeed
  /** The Game's Downtime (`useDowntime`). */
  downtime: DowntimeHandle
  mediator: boolean
}) {
  const storeState = useEntityStore()
  // The Crawler is Major while the Game's Downtime has a step running (D1, D8).
  const inDowntime = downtime.downtime.running
  // Screen arrangement stays on the device and resets with the page (D7).
  const [tab, setTab] = useState<DisplayTab>('resolve')
  const [reference, setReference] = useState<ReferenceFocus | null>(null)
  const [expanded, setExpanded] = useState<Expanded | null>(null)
  // The deck's Apply arms it; the slot row's Major opens Take Damage and consumes it.
  const [damageArmed, setDamageArmed] = useState(false)
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

  const deck = useActionsDeck({
    mech,
    pilot,
    crawler,
    mount,
    range: seat.seat.range,
    onRange: seat.setRange,
    resolving: seat.seat.resolving,
    onResolving: (next) => (next === null ? seat.clearResolving() : seat.setResolving(next)),
    onDamagePrompt: () => setDamageArmed(true),
  })

  if (!pilot) {
    return (
      <DashboardCanvas>
        <DashboardGrid
          rail={<span>Pilot not found</span>}
          primary={<div className="pc-placeholder">{`No pilot with id “${pilotId}”.`}</div>}
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
    : boarded
      ? `Mech · ${boarded.name}`
      : `Pilot · ${pilot.name}`

  const slots = {
    mech,
    pilot,
    crawler,
    boarded: boarded !== null,
    seat,
    board: boardMenu({ pilotId, assigned: composition.mech, sources }),
    mediator,
    upkeep: inDowntime
      ? {
          spent: downtime.downtime.upkeepSpent,
          payable: isUpkeepStep(downtime.downtime.stepIndex),
          spend: downtime.spendUpkeep,
        }
      : null,
    store: storeState,
  }
  // The Mediator's half of Downtime on the rail: Start, then End (plan §8 A1).
  const downtimeAction = !mediator
    ? undefined
    : isDowntime
      ? {
          label: '■ End Downtime',
          title: 'End Downtime for the whole table; everyone returns to their seat',
          onClick: downtime.end,
        }
      : {
          label: 'Start Downtime ▶',
          title: 'Start Downtime for the whole table at its first step',
          onClick: downtime.begin,
        }
  // The Reference tab shows the Major's entity until another is chosen.
  const referable: { focus: ReferenceFocus; label: string }[] = [
    { focus: 'pilot', label: 'Pilot' },
    ...(mech ? [{ focus: 'mech' as const, label: 'Mech' }] : []),
    ...(crawler ? [{ focus: 'crawler' as const, label: 'Crawler' }] : []),
  ]
  const majorRef: ReferenceFocus = onFoot || !mech ? 'pilot' : 'mech'
  const shownRef: ReferenceFocus =
    reference !== null && referable.some((r) => r.focus === reference) ? reference : majorRef
  const panel = { mech, pilot, crawler, mount, seat }
  // The Crew tab's rows, and its ▲ when any of them needs looking at (D6).
  const crew = crewLines(feed.crew, sources.seats, pilotId)
  // Choosing an action from the deck opens it in the Resolve tab.
  const { list } = deck
  const deckList =
    list.kind === 'list'
      ? {
          ...list,
          onOpen: (key: string) => {
            list.onOpen(key)
            setTab('resolve')
          },
        }
      : list
  const expandedName =
    expanded === null
      ? ''
      : expanded.kind === 'pilot'
        ? pilot.name
        : expanded.kind === 'mech'
          ? (mech?.name ?? '')
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
            status={<SavedIndicator gameName={feed.gameName} />}
            downtimeAction={downtimeAction}
          />
        }
        primary={
          <SlotRow
            {...slots}
            mount={mount}
            damagePrompt={{ armed: damageArmed, consume: () => setDamageArmed(false) }}
            onExpand={(kind, trigger) => setExpanded({ kind, trigger })}
          />
        }
        display={
          <div style={DISPLAY}>
            {isDowntime ? (
              <div style={DISPLAY_BODY}>
                <DowntimeWizard
                  crawler={crawler}
                  mech={mech}
                  pilot={pilot}
                  downtime={downtime}
                  mediator={mediator}
                  viewerId={sources.viewerId}
                />
              </div>
            ) : (
              <div style={DECK_AND_TABS}>
                <section aria-label="Actions" style={DECK}>
                  <DeckList view={deckList} />
                </section>
                <DisplayTabs
                  tab={tab}
                  onTab={setTab}
                  crewAttention={crew.some((c) => c.attention)}
                  panels={{
                    resolve: <ResolvePanel view={deck.resolve} />,
                    reference: (
                      <div style={REFERENCE}>
                        <DisplayPicker
                          focus={shownRef}
                          options={referable}
                          onFocus={setReference}
                        />
                        <div style={DISPLAY_BODY}>
                          <DisplayPanel focus={shownRef} {...panel} />
                        </div>
                      </div>
                    ),
                    tables: <DisplayPanel focus="tables" {...panel} />,
                    srd: <DisplayPanel focus="srd" {...panel} />,
                    log: <LogTab rolls={feed.rolls} alerts={feed.alerts} />,
                    crew: <CrewTab crew={crew} />,
                  }}
                />
              </div>
            )}
            <DashboardStrip
              gameName={feed.gameName}
              gameHref={feed.gameHref}
              alerts={feed.alerts}
              inbox={feed.inbox}
            />
            {expanded ? (
              <SlotOverlay
                title={`${SLOT_LABEL[expanded.kind]} · ${expandedName}`}
                returnFocusTo={expanded.trigger}
                onClose={() => setExpanded(null)}
              >
                <SlotMajor {...slots} kind={expanded.kind} mount={mount} damagePrompt={null} />
              </SlotOverlay>
            ) : null}
          </div>
        }
      />
    </DashboardCanvas>
  )
}
