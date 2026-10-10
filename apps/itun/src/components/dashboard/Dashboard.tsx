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
 * foot, and boards one from the Board menu (`BoardControl`, ADR-038 §3), which
 * reads the rest of the Game's mechs through `useBoardSources`. Whether this
 * pilot may be played at all is `DashboardGate`'s question, asked before this
 * renders.
 *
 * The top row is the `SlotRow`: one Major slot and two Minors, placed by the
 * mount (ADR-038 §3). ⤢ on a Minor opens that
 * entity's Major over the display (`SlotOverlay`) without moving the slots.
 *
 * Downtime is the Game's (ADR-038 §5): its `downtime` row, read through
 * `useDowntime`. While a step is running the Crawler is Major and the step
 * guide (`DowntimeWizard`) replaces the deck, on every member's Dashboard at
 * once; when it ends, each player is back wherever their seat says. The
 * Mediator starts and ends it from the rail and moves it on from the guide;
 * everyone marks their own step done.
 *
 * Below it, the deck (`DeckList`) sits beside the display's tabs
 * (`DisplayTabs`, ADR-038 §4): an action chosen from the deck opens in the Resolve
 * tab, and its progress is saved on the seat (`useActionsDeck`). A strip along
 * the bottom carries the Mediator's latest alert and the proposal count, and
 * the rail says whether play is being saved. What the rest of the table is
 * doing — the Game's rolls, alerts and the crew's derived status — is
 * `useGameFeed`'s.
 * Only the screen's arrangement stays on the device (ADR-038 §2): the open tab, the
 * Reference tab's entity, the deck's filters and the ⤢ overlay. So does the
 * deck's one-shot hand-off of a destructive outcome to the Major's Take Damage
 * overlay, which is component state here.
 *
 * **Two forms, one surface** (ADR-043). `DashboardCanvas` draws the canvas
 * above when it fits at 0.62 scale or more on both axes, and the phone form
 * (`DashboardPhone`) otherwise: unit tabs in place of the slot row, the deck
 * on the Major's tab, a resolve screen, and the display's other tabs behind
 * ≡. Both read the same seat, store and models, and every phone control
 * calls its canvas twin's handler. The state above lives here, above the
 * switch, so rotating or resizing keeps it; so do the phone's own open unit
 * tab, menu and resolve screen.
 */

import { buttonVariants, EmptyState } from 'component-lib'
import { ChevronLeft } from 'lucide-react'
// The dashboard's `.pc-*` stylesheet. component-lib's dashboard components
// import no CSS themselves — that rode the barrel into srd (audit PK-01) — so
// the one app that renders a dashboard loads it here, and it lands in this
// route's chunk rather than in every page's stylesheet.
import '../../styles/dashboard.css'
import { borderWidth, color } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { useRef, useState } from 'react'
import { useConnection } from '../../lib/connection/connectionContext'
import { resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import { downtimeStepCount, isUpkeepStep } from '../../lib/rules/downtime'
import { pilotingContext } from '../../lib/rules/pilotingContext'
import { useEntityStore } from '../../stores/entityStore'
import { AppLink } from '../shared/AppLink'
import type { EntityLookup } from '../sheet/composition'
import { resolveSheetComposition } from '../sheet/composition'
import { mechRailItems, pilotRailItems } from '../sheet/railStats'
import type { BoardSources } from './boardMenu'
import { boardMenu } from './boardMenu'
import { CrewTab } from './CrewTab'
import { DashboardCanvas } from './DashboardCanvas'
import { DashboardGrid } from './DashboardGrid'
import type { PhoneUnit, ResolveOpener } from './DashboardPhone'
import { DashboardPhone } from './DashboardPhone'
import { DashboardStrip } from './DashboardStrip'
import { DeckList } from './DeckList'
import type { ReferenceFocus } from './DisplayPanel'
import { DisplayPanel, DisplayPicker } from './DisplayPanel'
import type { DisplayTab } from './DisplayTabs'
import { DisplayTabs } from './DisplayTabs'
import { DowntimeWizard } from './DowntimeWizard'
import { DashboardFormContext, useUnitTab } from './dashboardForm'
import { LogTab } from './LogTab'
import { PhoneDeck } from './PhoneDeck'
import type { PhoneMenuView } from './PhoneMenu'
import { PhoneMenu } from './PhoneMenu'
import { PhoneResolve } from './PhoneResolve'
import type { PinnedVital } from './PinnedVitals'
import { RailBar } from './RailBar'
import { RailUnit } from './RailUnit'
import { ResolvePanel } from './ResolvePanel'
import { SavedIndicator } from './SavedIndicator'
import { SlotOverlay } from './SlotOverlay'
import { SlotMajor, SlotRow } from './SlotRow'
import type { SlotKind } from './slotLayout'
import { NO_CRAWLER, NO_MECH, slotsFor } from './slotLayout'
import {
  crawlerMinorModel,
  mechMinorModel,
  mechStats,
  pilotMinorModel,
  pilotVitals,
} from './slotModels'
import { useActionsDeck } from './useActionsDeck'
import { useBoardSources } from './useBoardSources'
import type { DowntimeHandle } from './useDowntime'
import { useDowntime } from './useDowntime'
import type { GameFeed } from './useGameFeed'
import { crewLines, useGameFeed } from './useGameFeed'
import type { MountState, SeatHandle } from './useSeat'
import { useSeat } from './useSeat'

type DashboardProps = {
  pilotId: string
  /**
   * The viewer is the Mediator of the pilot's Game, who alone runs the crawler
   * and Downtime (ADR-038 §5). `DashboardGate` reads it from `games.get`,
   * the membership's own flag.
   */
  mediator?: boolean
}

export function Dashboard({ pilotId, mediator = false }: DashboardProps) {
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
  // The Crawler is Major while the Game's Downtime has a step running.
  const inDowntime = downtime.downtime.running
  // Screen arrangement stays on the device and resets with the page.
  const [tab, setTab] = useState<DisplayTab>('resolve')
  const [reference, setReference] = useState<ReferenceFocus | null>(null)
  // The last Major a ⤢ opened stays set while the overlay closes, so its
  // content and the ⤢ that focus returns to outlive the close.
  const [expanded, setExpanded] = useState<Expanded | null>(null)
  const [overlayOpen, setOverlayOpen] = useState(false)
  // The display region the ⤢ overlay covers.
  const displayRef = useRef<HTMLDivElement>(null)
  // The deck's Apply arms it; the slot row's Major opens Take Damage and consumes it.
  const [damageArmed, setDamageArmed] = useState(false)
  // The phone form's arrangement (ADR-043): the ≡ menu and what it shows,
  // whether the resolve screen is set aside, and what opened it.
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuView, setMenuView] = useState<PhoneMenuView>('menu')
  const [resolveAside, setResolveAside] = useState(false)
  const [opener, setOpener] = useState<ResolveOpener | null>(null)
  const { canWrite, outdated, mode: connectionMode } = useConnection()
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
  // The Major-slot entity drives the whole-canvas tint (ADR-038 §8).
  const mount: MountState = inDowntime ? 'downtime' : boarded ? 'mech' : 'pilot'
  const [unitTab, setUnitTab] = useUnitTab(mount)
  // A resolve that ends (Done, a mount change) leaves nothing set aside.
  if (seat.seat.resolving === null && resolveAside) setResolveAside(false)

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
  // The rail's stamp says where the pilot is (boards D1–D3).
  const stepIndex = downtime.downtime.stepIndex
  const railStamp = isDowntime
    ? `Downtime · Step ${(stepIndex ?? 0) + 1} of ${downtimeStepCount()}`
    : boarded
      ? `Boarded · ${boarded.name}`
      : 'On foot'
  const railContext = isDowntime
    ? mediator
      ? 'You run it'
      : 'Run by the Mediator'
    : feed.gameName
      ? `Game · ${feed.gameName}`
      : undefined

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
  // The Mediator's half of Downtime on the rail: Start, then End.
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
  // The Crew tab's rows, and its ▲ when any of them needs looking at.
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
  const expand = (kind: SlotKind, trigger: HTMLButtonElement) => {
    setExpanded({ kind, trigger })
    setOverlayOpen(true)
  }
  // Downtime (board D3): the crawler has the row; the pilot and mech ride the
  // rail with their pips and open their full controls over the display.
  const railUnits = isDowntime ? (
    <>
      <RailUnit
        kind="pilot"
        label="Pilot"
        readings={[
          ...pilotRailItems(pilot, resolveEffectiveCrawlerLevel(pilot, crawler))
            .slice(0, 1)
            .map((r) => ({ ...r, pips: true })),
          { label: 'TP', value: pilot.trainingPoints ?? 0 },
        ]}
        onOpen={(trigger) => expand('pilot', trigger)}
      />
      {mech && (
        <RailUnit
          kind="mech"
          label={mech.name}
          readings={mechRailItems(mech, pilotingContext(mech, pilot.abilities)).map((r, i) => ({
            ...r,
            pips: i === 0,
          }))}
          onOpen={(trigger) => expand('mech', trigger)}
        />
      )}
    </>
  ) : undefined
  const expandedName =
    expanded === null
      ? ''
      : expanded.kind === 'pilot'
        ? pilot.name
        : expanded.kind === 'mech'
          ? (mech?.name ?? '')
          : (crawler?.name ?? '')

  // The display's panels: the canvas's tabs, and the phone's ≡ panels.
  const panels = {
    reference: (
      <div style={REFERENCE}>
        <DisplayPicker focus={shownRef} options={referable} onFocus={setReference} />
        <div style={DISPLAY_BODY}>
          <DisplayPanel focus={shownRef} {...panel} />
        </div>
      </div>
    ),
    tables: <DisplayPanel focus="tables" {...panel} />,
    srd: <DisplayPanel focus="srd" {...panel} />,
    log: <LogTab rolls={feed.rolls} alerts={feed.alerts} />,
    crew: <CrewTab crew={crew} gameId={feed.gameId} />,
  }
  const crewAttention = crew.some((c) => c.attention)

  // The phone form (ADR-043). Built here, rendered by DashboardCanvas only
  // below the canvas's floor.
  const { major } = slotsFor(mount)
  const stats = mech ? mechStats(mech, pilot.abilities, seat.seat.activeEffects) : null
  const [hpGauge, apGauge] = pilotVitals(pilot, crawler).gauges
  const vital = (g: { label: string; value: number; max: number } | undefined): PinnedVital[] =>
    g ? [{ label: g.label, value: g.value, max: g.max }] : []
  const heatVital: PinnedVital[] =
    boarded && stats ? [{ label: 'Heat', value: stats.heat, max: stats.maxHeat }] : []
  // Under the tabs, off the Major's tab: what the Major spends (D8).
  const pinned: PinnedVital[] = isDowntime
    ? []
    : boarded && stats
      ? [
          { label: 'SP', value: stats.sp, max: stats.maxSP },
          { label: 'EP', value: stats.ep, max: stats.maxEP },
          ...heatVital,
        ]
      : [...vital(hpGauge), ...vital(apGauge)]
  const resolve = deck.resolve
  // The resolve header: Heat while boarded, and what the action spends.
  const spendVital: PinnedVital[] =
    resolve.kind !== 'resolve'
      ? []
      : resolve.currency === 'AP'
        ? vital(apGauge)
        : stats
          ? [{ label: 'EP', value: stats.ep, max: stats.maxEP }]
          : []
  const openFromDeck = (key: string, kind: 'row' | 'pennant') => {
    if (list.kind !== 'list') return
    setOpener({ kind, key })
    setResolveAside(false)
    if (kind === 'pennant') list.onActivate(key)
    else list.onOpen(key)
  }
  // The deck on the Major's tab; in Downtime, the guide on the Crawler's.
  const between = (kind: SlotKind) =>
    kind !== major ? null : isDowntime ? (
      <DowntimeWizard
        crawler={crawler}
        mech={mech}
        pilot={pilot}
        downtime={downtime}
        mediator={mediator}
        viewerId={sources.viewerId}
      />
    ) : (
      <PhoneDeck
        view={list}
        onOpen={(key) => openFromDeck(key, 'row')}
        onActivate={(key) => openFromDeck(key, 'pennant')}
      />
    )
  const unit = (kind: SlotKind, name: string | null, problems: readonly string[]): PhoneUnit => {
    const missing = (kind === 'mech' && !mech) || (kind === 'crawler' && !crawler)
    return {
      name,
      problems,
      body: missing ? (
        <>
          <EmptyState variant="quiet" body={kind === 'mech' ? NO_MECH : NO_CRAWLER} />
          {between(kind)}
        </>
      ) : (
        <DashboardFormContext value={{ form: 'phone', between: between(kind) }}>
          <SlotMajor
            {...slots}
            kind={kind}
            mount={mount}
            // The Major's tab answers the deck's Take Damage hand-off.
            damagePrompt={
              kind === major ? { armed: damageArmed, consume: () => setDamageArmed(false) } : null
            }
          />
        </DashboardFormContext>
      ),
    }
  }
  const readOnly = canWrite
    ? null
    : outdated
      ? 'Read-only: this tab is updating to the new build.'
      : connectionMode === 'disconnected'
        ? 'Read-only: offline until the connection returns.'
        : 'Read-only while the connection settles.'
  const resolving = seat.seat.resolving
  const resolveOpen = resolving !== null && !resolveAside && !isDowntime
  const phone = (
    <DashboardPhone
      gameName={feed.gameName}
      homeHref={feed.gameHref ?? '/'}
      major={major}
      mountKey={`${mount}:${boardedId ?? ''}`}
      mountNote={isDowntime ? 'Downtime started' : boarded ? `Boarded ${boarded.name}` : 'On foot'}
      tab={unitTab}
      onTab={setUnitTab}
      units={{
        pilot: unit(
          'pilot',
          pilot.name,
          pilotMinorModel(pilot, crawler, boarded ? boarded.name : null).problems
        ),
        mech: unit(
          'mech',
          mech?.name ?? null,
          mech
            ? mechMinorModel(mech, pilot.abilities, seat.seat.activeEffects, boarded !== null)
                .problems
            : []
        ),
        crawler: unit(
          'crawler',
          crawler?.name ?? null,
          crawler ? crawlerMinorModel(crawler).problems : []
        ),
      }}
      pinned={pinned}
      readOnly={readOnly}
      resume={
        resolving !== null && !isDowntime
          ? {
              name: resolving.name,
              onResume: () => {
                setOpener({ kind: 'resume', key: resolving.ref })
                setResolveAside(false)
              },
            }
          : null
      }
      resolveScreen={
        resolveOpen ? (
          <PhoneResolve
            view={resolve}
            vitals={[...heatVital, ...spendVital]}
            readOnly={readOnly}
            onBack={() => setResolveAside(true)}
            onTakeHit={() => {
              setResolveAside(true)
              setUnitTab(major)
            }}
          />
        ) : null
      }
      opener={opener}
      crewAttention={crewAttention}
      inbox={feed.inbox}
      onSearch={() => {
        setMenuView('srd')
        setMenuOpen(true)
      }}
      onMenu={() => {
        setMenuView('menu')
        setMenuOpen(true)
      }}
      menu={
        <PhoneMenu
          open={menuOpen}
          view={menuView}
          onView={setMenuView}
          onClose={() => setMenuOpen(false)}
          game={
            <>
              <DashboardStrip
                gameName={feed.gameName}
                gameHref={feed.gameHref}
                alerts={feed.alerts}
                inbox={feed.inbox}
              />
              <SavedIndicator />
            </>
          }
          crewAttention={crewAttention}
          panels={panels}
          downtimeAction={downtimeAction}
          gameHref={feed.gameHref}
        />
      }
    />
  )

  return (
    <DashboardCanvas phone={phone}>
      <DashboardGrid
        mount={mount}
        rail={
          <RailBar
            name={pilot.name}
            stamp={railStamp}
            fam={fam}
            context={railContext}
            units={railUnits}
            returnControl={
              <AppLink
                href={feed.gameHref ?? '/'}
                aria-label={feed.gameName ? `Back to ${feed.gameName}` : 'Back to Shelves'}
                className={buttonVariants({
                  surface: 'instrument',
                  variant: 'ghost',
                  size: 'iconOnly',
                })}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </AppLink>
            }
            status={<SavedIndicator />}
            downtimeAction={downtimeAction}
          />
        }
        primary={
          <SlotRow
            {...slots}
            mount={mount}
            damagePrompt={{ armed: damageArmed, consume: () => setDamageArmed(false) }}
            onExpand={expand}
          />
        }
        display={
          <div ref={displayRef} style={DISPLAY}>
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
                  crewAttention={crewAttention}
                  panels={{ resolve: <ResolvePanel view={deck.resolve} />, ...panels }}
                />
              </div>
            )}
            <DashboardStrip
              gameName={feed.gameName}
              gameHref={feed.gameHref}
              alerts={feed.alerts}
              inbox={feed.inbox}
            />
            <SlotOverlay
              open={overlayOpen}
              title={expanded ? `${SLOT_LABEL[expanded.kind]} · ${expandedName}` : ''}
              container={displayRef}
              returnFocusTo={expanded?.trigger ?? null}
              onClose={() => setOverlayOpen(false)}
            >
              {expanded ? (
                <SlotMajor {...slots} kind={expanded.kind} mount={mount} damagePrompt={null} />
              ) : null}
            </SlotOverlay>
          </div>
        }
      />
    </DashboardCanvas>
  )
}
