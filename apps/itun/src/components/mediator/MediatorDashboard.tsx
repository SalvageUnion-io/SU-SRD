/**
 * MediatorDashboard — the Mediator's surface for running a Game, at
 * `/mediator/$gameId` (board M1; docs/architecture/mediator-dashboard.md).
 *
 * It reads the table live — the seats (`crew.vitals`, `seats.forGame`, in
 * `games.members` join order), the primary crawler (`entities.listForGame`),
 * Downtime, the tray (`mediator.npcs`), what the Mediator has proposed
 * (`proposals.sent`), the alerts and the Game's rolls — and makes the writes
 * the Mediator already holds: Downtime (ADR-030 §3), the tray, proposals
 * (ADR-030 §4) and alerts. It writes nothing a player owns; a player's sheet
 * is reached only by proposal.
 *
 * `MediatorGate` decides whether to render it. Offline or outdated, what the
 * subscriptions last delivered stays on screen and every control is disabled,
 * not hidden, so the layout does not jump when the connection returns.
 * Writes are blocked, never queued (ADR-030 §1).
 */

// The dashboard's `.pc-*` stylesheet (the canvas, grid and rail), loaded with
// this route's chunk as the player Dashboard loads it with its own.
import '../../styles/dashboard.css'
import { d20ForTable, toast } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { PROPOSALS_PAGE, proposalTargets } from '../../lib/games/proposals'
import { downtimeStepNames } from '../../lib/rules/downtime'
import { failureMessage } from '../shared/useConfirm'
import { readCrawler } from './crawlerReading'
import type { MediatorTableView, MediatorTableWrites } from './MediatorDashboardView'
import { MediatorDashboardView } from './MediatorDashboardView'
import { newTrayNpc, readTrayNpc, rollMorale } from './opposition'
import { tableSeats } from './seatCards'

/** How many alerts and rolls the Log and Tell the table read. */
const LOG_ALERTS = 20
const LOG_ROLLS = 30

/** "2 min ago" moves on without a write to prompt it. */
const CLOCK_MS = 30_000

function useClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), CLOCK_MS)
    return () => window.clearInterval(id)
  }, [])
  return now
}

export function MediatorDashboard({ gameId, gameName }: { gameId: string; gameName: string }) {
  const id = gameId as Id<'games'>
  const { canWrite } = useConnection()
  const now = useClock()
  const [sentLimit, setSentLimit] = useState(PROPOSALS_PAGE)
  const toRef = useRef<HTMLInputElement | null>(null)

  const members = useQuery(api.games.members, { gameId: id })
  const crew = useQuery(api.crew.vitals, { gameId: id })
  const seats = useQuery(api.seats.forGame, { gameId: id })
  const listing = useQuery(api.entities.listForGame, { gameId: id })
  const downtime = useQuery(api.downtime.state, { gameId: id })
  const npcs = useQuery(api.mediator.npcs, { gameId: id })
  const sent = useQuery(api.proposals.sent, { gameId: id, limit: sentLimit })
  const alerts = useQuery(api.proposals.alerts, { gameId: id, limit: LOG_ALERTS })
  const rolls = useQuery(api.changeLog.rolls, { gameId: id, limit: LOG_ROLLS })

  const begin = useMutation(api.downtime.begin)
  const advance = useMutation(api.downtime.advance)
  const end = useMutation(api.downtime.end)
  const spendUpkeep = useMutation(api.downtime.spendUpkeep)
  const addNpc = useMutation(api.mediator.addNpc)
  const updateNpc = useMutation(api.mediator.updateNpc)
  const removeNpc = useMutation(api.mediator.removeNpc)
  const propose = useMutation(api.proposals.propose)
  const broadcast = useMutation(api.proposals.broadcast)

  const primary =
    listing?.crawlers.find((c) => c._id === listing.primaryCrawlerId) ??
    listing?.crawlers[0] ??
    null
  const tray = npcs?.map(readTrayNpc) ?? null

  const view: MediatorTableView = {
    gameId,
    gameName,
    seats: tableSeats(crew ?? null, seats ?? [], members ?? []),
    crawler: primary === null ? null : readCrawler(primary),
    downtime: {
      running: downtime?.running ?? false,
      stepIndex: downtime?.stepIndex ?? null,
      done: downtime?.completedBy.length ?? 0,
      upkeepSpent: downtime?.upkeepSpent ?? false,
    },
    downtimeSteps: downtimeStepNames(),
    memberCount: members?.length ?? 0,
    npcs: tray,
    targets: proposalTargets(crew ?? null),
    sent: sent ?? null,
    sentLimit,
    alerts: alerts ?? [],
    rolls: rolls ?? null,
    now,
    canWrite,
  }

  /** A refusal reads as the server's own words; anything else is reported. */
  const onFailure = (err: unknown) => {
    toast.error(failureMessage(err, 'That did not reach the table. Try again.'), {
      id: 'mediator-write',
    })
  }

  /** Run a write, say why when it is refused, and still reject for the caller. */
  const said =
    <A extends unknown[]>(write: (...args: A) => Promise<unknown>) =>
    async (...args: A): Promise<void> => {
      try {
        await write(...args)
      } catch (err) {
        onFailure(err)
        throw err
      }
    }

  const writes: MediatorTableWrites = {
    downtime: {
      begin: () => begin({ gameId: id }),
      advance: () => advance({ gameId: id }),
      end: () => end({ gameId: id }),
      spendUpkeep: () => spendUpkeep({ gameId: id }),
    },
    tray: {
      add: (schema, entity) =>
        addNpc({
          gameId: id,
          body: newTrayNpc(
            schema,
            entity,
            (tray ?? []).map((n) => n.name),
            new Date().toISOString()
          ),
        }),
      setHp: (npc, next) =>
        updateNpc({ npcId: npc.id as Id<'encounterNpcs'>, patch: { currentHp: next } }),
      morale: async (npc) => {
        // Morale is a named Salvage Union table: its die is @randsum/salvageunion's
        // rollTable('Morale'); rollMorale reads the row from our own data.
        const result = rollMorale(await d20ForTable('Morale'), new Date().toISOString())
        if (result === null) throw new Error('The Morale table could not be read')
        await updateNpc({
          npcId: npc.id as Id<'encounterNpcs'>,
          patch: { lastMediatorRoll: result },
        })
      },
      remove: (npc) => removeNpc({ npcId: npc.id as Id<'encounterNpcs'> }),
    },
    propose: said(async (args) => {
      await propose(args)
    }),
    broadcast: said(async (message: string) => {
      await broadcast({ gameId: id, message })
    }),
    moreSent: () => setSentLimit((n) => n + PROPOSALS_PAGE),
    onFailure,
  }

  return <MediatorDashboardView view={view} writes={writes} toRef={toRef} />
}
