/**
 * usePlayMediator — everything the Mediator's Play screen reads and writes
 * (play.md §10), from one call in `PlayMediatorCockpit`, handed to every
 * column so all three read the same table.
 *
 * It reads the table live — the seats (`crew.vitals`, `seats.forGame`, in
 * `games.members` join order), the primary crawler (`entities.listForGame`;
 * the Mediator's store holds it, so its box is live), the Game's Downtime
 * (`usePlayDowntime`, as the Mediator), the tray (`mediator.npcs`), the saved
 * patterns the picker may field, the proposals sent, the alerts and the
 * Game's rolls, the area being salvaged — and makes the writes the Mediator
 * holds: the Opposition, a downed wreck's salvage into the crawler, the area,
 * proposals (ADR-030 §4) and alerts. It
 * writes nothing a player owns; a player's sheet is reached only by proposal.
 *
 * A Morale roll is kept on the NPC (`lastMediatorRoll`) and goes on Play's
 * roll log (`recordPlayRoll`), which keeps the Mediator's rolls off the
 * Game's log and posts one only when the Post toggle (private by default) or
 * the roll's own Post says so.
 */

import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { dealCount } from 'game-domain/games/ledger'
import { PROPOSALS_PAGE } from 'game-domain/games/proposals'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Encounter, RunningEncounter } from 'game-domain/schemas/encounter'
import { RunningEncounterSchema } from 'game-domain/schemas/encounter'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { dieForTable, rollD20, toast } from '../../components/index'
import { useConnection } from '../../lib/connection/connectionContext'
import { failureMessage } from '../../lib/connection/useServerAction'
import { rollMorale } from '../../lib/rules/opposition'
import { runWrite } from '../../lib/runWrite'
import { parseFrozenEntity } from '../../lib/schemas/frozenEntity'
import { useEntityStore } from '../../stores/entityStore'
import { usePrepStore } from '../../stores/prepStore'
import { PLAY_TXN } from '../../stores/surfaceProvenance'
import type { PlayReadOnly } from '../play.model'
import { mediatorTarget, playReadOnly } from '../play.model'
import { recordPlayRoll } from '../playRolls.model'
import type { PlayDowntime } from '../situation.model'
import type { AlertLine, CrewVitals, RollLine } from '../useGameFeed'
import { usePlayDowntime } from '../usePlayDowntime'
import { usePresenceClock } from '../usePresenceClock'
import type { SalvageAreaView } from '../useSalvageArea'
import { useSalvageArea } from '../useSalvageArea'
import type { MediatorSeat } from './mediatorTable.model'
import { mediatorSeats } from './mediatorTable.model'
import type { TrayWrites } from './OppositionPicker'
import type { SavedPattern, TrayNpc } from './opposition.model'
import { newTrayNpc, readSavedPattern, readTrayNpc } from './opposition.model'
import type { ProposeArgs } from './ProposeDock'
import type { SentProposal } from './proposalLine.model'

/** A wreck's salvage that hauls nothing: it is settled, and nothing is written. */
export const NOTHING = (): null => null

/** How many alerts and rolls the Feed reads. */
const FEED_ALERTS = 20
const FEED_ROLLS = 30

export type PlayMediator = {
  gameId: string
  gameName: string
  /** Every claimed seat, in join order. */
  seats: MediatorSeat[]
  /** The crew read, for Propose's targets and the seats' sheets. */
  crew: CrewVitals | null
  /** The Game's primary crawler, and whether the store holds it (may write it). */
  crawler: { crawler: Crawler; held: boolean } | null
  /** The Game's Downtime, as its Mediator runs it. */
  downtime: PlayDowntime
  /** What the crew's faction deals pay this Downtime (`ledger.collectIncome`). */
  income: DealIncome
  /** The tray, hidden from players; null while it loads. */
  npcs: TrayNpc[] | null
  savedPatterns: SavedPattern[]
  tray: TrayWrites
  /**
   * Settle a downed wreck's salvage: claim it (`salvaged`, once), then write
   * `haul`'s patch of the crawler as it stands. `NOTHING` settles a wreck
   * that yields nothing; any other haul is refused with no crawler the
   * Mediator holds.
   */
  salvageWreck: (npc: TrayNpc, haul: (crawler: Crawler) => Partial<Crawler> | null) => Promise<void>
  /** The area the crew is salvaging, which the Mediator names (Core Book p.245). */
  area: SalvageAreaView
  /** The Mediator's prep (ADR-059): their encounters, and the one this Game is running. */
  prep: MediatorPrep
  /** Newest first; null while the first answer is on its way. */
  sent: SentProposal[] | null
  sentLimit: number
  moreSent: () => void
  propose: (args: ProposeArgs) => Promise<void>
  broadcast: (message: string) => Promise<void>
  alerts: AlertLine[]
  rolls: RollLine[] | null
  /** Say why the server refused a write. */
  onFailure: (err: unknown) => void
  /** The clock presence and "2 min ago" are read against. */
  now: number
  canWrite: boolean
  readOnly: PlayReadOnly | null
}

/** The Game's deal income: a Scrap per deal, collected once per Downtime at Upkeep. */
type DealIncome = {
  /** The factions the crew has a deal with; 0 while the ledger loads. */
  deals: number
  /** This Downtime's is collected. */
  collected: boolean
  /** Collect it into the crawler: what it paid, or null when it already was. */
  collect: () => Promise<FunctionReturnType<typeof api.ledger.collectIncome>>
}

/** The Mediator's encounters, and the one the Game is running (ADR-059). */
type MediatorPrep = {
  /** Theirs, from their shelf; a Game runs a copy, never holds one. */
  encounters: Encounter[]
  /** The one running; null when none is (or while it loads). */
  running: RunningEncounter | null
  /** Run one: its opposition joins the tray (`clear` empties the tray first). */
  run: (encounterId: string, clear: boolean) => Promise<{ added: number }>
  /** Stop running it: its notes and tables leave Play; the Opposition stays. */
  end: () => Promise<void>
}

/** A running encounter as the server keeps it, or null when it does not read. */
function readRunning(body: unknown): RunningEncounter | null {
  const parsed = RunningEncounterSchema.safeParse(body)
  return parsed.success ? parsed.data : null
}

/** The Game's primary crawler: from the store when it is held (live), else the listing. */
function primaryCrawler(
  listing: { crawlers: { _id: string; appId: string | null; body: unknown }[] } & {
    primaryCrawlerId: string | null
  },
  get: (id: string) => Crawler | null
): { crawler: Crawler; held: boolean } | null {
  const row =
    listing.crawlers.find((c) => c._id === listing.primaryCrawlerId) ?? listing.crawlers[0]
  if (row === undefined) return null
  const parsed = parseFrozenEntity('crawler', row.body)
  const id = row.appId ?? (parsed.ok ? parsed.entity.id : null)
  if (id === null) return null
  const held = get(id)
  if (held !== null) return { crawler: held, held: true }
  if (!parsed.ok || parsed.kind !== 'crawler') return null
  return { crawler: { ...(parsed.entity as Crawler), id }, held: false }
}

export function usePlayMediator(gameId: string, gameName: string): PlayMediator {
  const id = gameId as Id<'games'>
  const connection = useConnection()
  const { canWrite } = connection
  const now = usePresenceClock()
  const store = useEntityStore()
  const [sentLimit, setSentLimit] = useState(PROPOSALS_PAGE)

  const members = useQuery(api.games.members, { gameId: id })
  const crew = useQuery(api.crew.vitals, { gameId: id })
  const seats = useQuery(api.seats.forGame, { gameId: id })
  const listing = useQuery(api.entities.listForGame, { gameId: id })
  const npcs = useQuery(api.mediator.npcs, { gameId: id })
  const running = useQuery(api.mediator.running, { gameId: id })
  const encounters = usePrepStore((s) => s.encounters)
  const patterns = useQuery(api.mediator.patterns, { gameId: id })
  const sent = useQuery(api.proposals.sent, { gameId: id, limit: sentLimit })
  const alerts = useQuery(api.proposals.alerts, { gameId: id, limit: FEED_ALERTS })
  const rolls = useQuery(api.changeLog.rolls, { gameId: id, limit: FEED_ROLLS })
  const downtime = usePlayDowntime(mediatorTarget(gameId))
  const area = useSalvageArea(mediatorTarget(gameId))
  const ledger = useQuery(api.ledger.get, { gameId: id })
  const collectIncome = useMutation(api.ledger.collectIncome)

  const addNpc = useMutation(api.mediator.addNpc)
  const updateNpc = useMutation(api.mediator.updateNpc)
  const removeNpc = useMutation(api.mediator.removeNpc)
  const runEncounter = useMutation(api.mediator.runEncounter)
  const endEncounter = useMutation(api.mediator.endEncounter)
  const proposeMutation = useMutation(api.proposals.propose)
  const broadcastMutation = useMutation(api.proposals.broadcast)

  const tray = npcs?.map(readTrayNpc) ?? null

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

  const npcId = (npc: TrayNpc) => npc.id as Id<'encounterNpcs'>

  const trayWrites: TrayWrites = {
    add: (schema, entity, draw) =>
      addNpc({
        gameId: id,
        body: newTrayNpc(
          schema,
          entity,
          (tray ?? []).map((n) => n.name),
          new Date().toISOString(),
          draw
        ),
      }),
    setHp: (npc, next) => updateNpc({ npcId: npcId(npc), patch: { currentHp: next } }),
    morale: async (npc) => {
      // Morale is a named Salvage Union table (Core Book p.268); its die is
      // rollTable('Morale'), and rollMorale reads the row from our own data.
      const result = rollMorale(await dieForTable('Morale'), new Date().toISOString())
      if (result === null) throw new Error('The Morale table could not be read')
      await updateNpc({ npcId: npcId(npc), patch: { lastMediatorRoll: result } })
      recordPlayRoll({
        tableName: 'Morale',
        rolls: [result.roll],
        label: `${npc.name} · Morale`,
        outcome: result.label ?? result.value,
      })
    },
    remove: (npc) => removeNpc({ npcId: npcId(npc) }),
    rename: (npc, name) => updateNpc({ npcId: npcId(npc), patch: { name } }),
    field: async (lines) => {
      // One at a time, each name counted against the ones before it, so four
      // Contour Hussars come out numbered.
      const taken = (tray ?? []).map((n) => n.name)
      let added = 0
      for (const line of lines) {
        if (line.draw === null) continue
        const { schema, entity, pattern } = line.draw
        let count = line.count
        if (count === 'd20') {
          count = rollD20()
          recordPlayRoll({
            tableName: 'd20',
            rolls: [count],
            label: line.text,
            outcome: `${count}`,
          })
        }
        for (let i = 0; i < count; i++) {
          const body = newTrayNpc(
            schema,
            entity,
            taken,
            new Date().toISOString(),
            pattern ? { pattern } : {}
          )
          await addNpc({ gameId: id, body })
          taken.push(body.name)
          added += 1
        }
      }
      return added
    },
  }

  const crawler =
    listing == null ? null : primaryCrawler(listing, (crawlerId) => store.get('crawler', crawlerId))

  return {
    gameId,
    gameName,
    seats: mediatorSeats(crew ?? null, seats ?? [], members ?? [], now),
    crew: crew ?? null,
    crawler,
    downtime,
    income: {
      deals: ledger ? dealCount(ledger) : 0,
      collected: ledger?.incomeCollected ?? false,
      collect: () => collectIncome({ gameId: id }),
    },
    npcs: tray,
    savedPatterns: (patterns ?? []).flatMap((row) => readSavedPattern(row) ?? []),
    tray: trayWrites,
    salvageWreck: said(async (npc: TrayNpc, haul: (c: Crawler) => Partial<Crawler> | null) => {
      const held = crawler?.held ? crawler.crawler : null
      const patch = held === null ? null : haul(store.get('crawler', held.id) ?? held)
      if (held === null && haul !== NOTHING) throw new Error('There is no crawler to haul it to')
      // Claimed first, as a Downtime step is: a second press never pays twice.
      // A wreck that yields nothing is settled too: what was left is destroyed.
      await updateNpc({ npcId: npcId(npc), patch: { salvaged: true } })
      if (held !== null && patch !== null) {
        runWrite(() => store.update('crawler', held.id, patch, PLAY_TXN))
      }
    }),
    area,
    prep: {
      encounters,
      running: running == null ? null : readRunning(running),
      run: (encounterId, clear) => runEncounter({ gameId: id, encounterId, clear }),
      end: async () => {
        await endEncounter({ gameId: id })
      },
    },
    sent: sent ?? null,
    sentLimit,
    moreSent: () => setSentLimit((n) => n + PROPOSALS_PAGE),
    propose: said(async (args: ProposeArgs) => {
      await proposeMutation(args)
    }),
    broadcast: said(async (message: string) => {
      await broadcastMutation({ gameId: id, message })
    }),
    alerts: alerts ?? [],
    rolls: rolls ?? null,
    onFailure,
    now,
    canWrite,
    readOnly: playReadOnly(connection),
  }
}
