/**
 * MediatorDashboardView — the Mediator Dashboard laid out (board M1;
 * docs/architecture/mediator-dashboard.md §6): a 1280×800 `DashboardCanvas`
 * with the rail, The table beside the Crawler and Downtime minors, and the
 * display (tabs and the propose dock) below.
 *
 * Below a 0.8 scale (a phone, or a narrow window) the same panels stack in one
 * scrolling column instead — rail, The table (two cards a row), Downtime,
 * Crawler, then the tabs — so a Mediator on a phone keeps everything the Game
 * page gave them before (Q4). A 1024px tablet in landscape keeps the canvas.
 *
 * Presentational: `MediatorDashboard` reads the Game and makes the writes, so
 * the catalog can stage this with fixtures.
 */

import { tokens } from 'component-lib'
import type { CSSProperties, RefObject } from 'react'
import { useState } from 'react'
import type { ProposalTarget } from '../../lib/games/proposals'
import { DashboardCanvas } from '../dashboard/DashboardCanvas'
import { DashboardGrid } from '../dashboard/DashboardGrid'
import { LogTab } from '../dashboard/LogTab'
import { SrdExplorer } from '../dashboard/SrdExplorer'
import type { AlertLine, RollLine } from '../dashboard/useGameFeed'
import { CrawlerMinor } from './CrawlerMinor'
import type { CrawlerReading } from './crawlerReading'
import type { DowntimeReading, DowntimeWrites } from './DowntimeMinor'
import { DowntimeMinor } from './DowntimeMinor'
import type { MediatorTab } from './MediatorDisplay'
import { MediatorDisplay } from './MediatorDisplay'
import { MediatorRail } from './MediatorRail'
import type { TrayWrites } from './OppositionTab'
import { OppositionTab } from './OppositionTab'
import type { TrayNpc } from './opposition'
import { ProposalsList } from './ProposalsList'
import type { ProposeArgs } from './ProposeDock'
import { ProposeDock } from './ProposeDock'
import type { SentProposal } from './proposalLine'
import type { SeatCard } from './seatCards'
import { seatSummary } from './seatCards'
import { TableSeats } from './TableSeats'
import { TellTheTable } from './TellTheTable'

const { space } = tokens

/** The canvas floor for this surface: below it, the stacked column (Q4). */
const MEDIATOR_MIN_SCALE = 0.8

export type MediatorTableView = {
  gameId: string
  gameName: string
  seats: readonly SeatCard[]
  crawler: CrawlerReading | null
  downtime: DowntimeReading
  downtimeSteps: readonly string[]
  memberCount: number
  npcs: readonly TrayNpc[] | null
  targets: readonly ProposalTarget[]
  /** Newest first; null while the first answer is on its way. */
  sent: readonly SentProposal[] | null
  sentLimit: number
  alerts: readonly AlertLine[]
  rolls: RollLine[] | null
  /** The clock "2 min ago" is read against. */
  now: number
  /** False offline or outdated: every control disabled, none hidden. */
  canWrite: boolean
}

export type MediatorTableWrites = {
  downtime: DowntimeWrites
  tray: TrayWrites
  propose: (args: ProposeArgs) => Promise<void>
  broadcast: (message: string) => Promise<void>
  moreSent: () => void
  /** Say why the server refused a write. */
  onFailure: (err: unknown) => void
}

/** Rail · the table and the minors · the display, in the grid's three rows. */
const PRIMARY: CSSProperties = {
  height: '100%',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 218px 218px',
  gap: '10px',
}

/** The phone column. */
const COLUMN: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[10],
  padding: `${space[8]} ${space[10]} ${space[24]}`,
}

/** The rail outside the grid keeps `.pc-rail`'s look and wraps. */
const STACKED_RAIL: CSSProperties = { minHeight: '40px', flexWrap: 'wrap', padding: space[8] }

const STACKED_MINORS: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))',
  gap: space[10],
}

const STACKED_DISPLAY: CSSProperties = { borderRadius: '6px' }

const DISPLAY_FILL: CSSProperties = { height: '100%', minHeight: 0 }

function Panels({
  view,
  writes,
  stacked,
  picked,
  onPick,
  tab,
  onTab,
  toRef,
}: {
  view: MediatorTableView
  writes: MediatorTableWrites
  stacked: boolean
  picked: string | null
  onPick: (target: string | null) => void
  tab: MediatorTab
  onTab: (tab: MediatorTab) => void
  toRef: RefObject<HTMLInputElement | null>
}) {
  const rail = (
    <MediatorRail gameId={view.gameId} gameName={view.gameName} summary={seatSummary(view.seats)} />
  )
  const seats = (
    <TableSeats
      seats={view.seats}
      picked={picked}
      stacked={stacked}
      onPick={(seat) => {
        onPick(seat.rowId)
        // Seeing the problem and proposing the fix is one tap (Q5).
        toRef.current?.focus()
      }}
    />
  )
  const crawler = <CrawlerMinor crawler={view.crawler} gameId={view.gameId} />
  const downtime = (
    <DowntimeMinor
      downtime={view.downtime}
      steps={view.downtimeSteps}
      members={view.memberCount}
      upkeepTl={view.crawler?.techLevel ?? null}
      canWrite={view.canWrite}
      writes={writes.downtime}
      onFailure={writes.onFailure}
    />
  )
  const display = (
    <MediatorDisplay
      tab={tab}
      onTab={onTab}
      stacked={stacked}
      panels={{
        opposition: (
          <OppositionTab
            npcs={view.npcs}
            canWrite={view.canWrite}
            writes={writes.tray}
            onFailure={writes.onFailure}
          />
        ),
        proposals: (
          <div style={{ ...DISPLAY_FILL, overflowY: 'auto', padding: space[12] }}>
            <ProposalsList
              proposals={view.sent}
              limit={view.sentLimit}
              now={view.now}
              onMore={writes.moreSent}
            />
          </div>
        ),
        tell: (
          <TellTheTable
            alerts={view.alerts}
            now={view.now}
            canWrite={view.canWrite}
            onSend={writes.broadcast}
          />
        ),
        srd: <SrdExplorer />,
        log: <LogTab rolls={view.rolls} alerts={[...view.alerts]} />,
      }}
      dock={
        <ProposeDock
          targets={view.targets}
          targetId={picked}
          onTarget={onPick}
          recent={(view.sent ?? []).slice(0, 3)}
          now={view.now}
          canWrite={view.canWrite}
          onPropose={writes.propose}
          toRef={toRef}
        />
      }
    />
  )

  if (stacked) {
    return (
      <div style={COLUMN}>
        <div className="pc-rail" style={STACKED_RAIL}>
          {rail}
        </div>
        {seats}
        <div style={STACKED_MINORS}>
          {downtime}
          {crawler}
        </div>
        <div className="pc-display pc-display-light" style={STACKED_DISPLAY}>
          {display}
        </div>
      </div>
    )
  }
  return (
    <DashboardGrid
      rail={rail}
      primary={
        <div style={PRIMARY}>
          {seats}
          {crawler}
          {downtime}
        </div>
      }
      display={display}
    />
  )
}

export function MediatorDashboardView({
  view,
  writes,
  toRef,
}: {
  view: MediatorTableView
  writes: MediatorTableWrites
  toRef: RefObject<HTMLInputElement | null>
}) {
  // Screen arrangement stays on the device and resets with the page.
  const [tab, setTab] = useState<MediatorTab>('opposition')
  const [picked, setPicked] = useState<string | null>(null)
  const shared = { view, writes, picked, onPick: setPicked, tab, onTab: setTab, toRef }

  return (
    <DashboardCanvas minScale={MEDIATOR_MIN_SCALE} reflow={<Panels {...shared} stacked />}>
      <Panels {...shared} stacked={false} />
    </DashboardCanvas>
  )
}
