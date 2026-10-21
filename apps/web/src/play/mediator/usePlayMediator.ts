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
 * Game's rolls — and makes the writes the Mediator holds: the Opposition,
 * proposals (ADR-030 §4) and alerts. It
 * writes nothing a player owns; a player's sheet is reached only by proposal.
 *
 * A Morale roll is kept on the NPC (`lastMediatorRoll`) and goes on Play's
 * roll log (`recordPlayRoll`), which keeps the Mediator's rolls off the
 * Game's log and posts one only when the Post toggle (private by default) or
 * the roll's own Post says so.
 */

import { useMutation, useQuery } from 'convex/react'
import { PROPOSALS_PAGE } from 'game-domain/games/proposals'
import type { Crawler } from 'game-domain/schemas/crawler'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { dieForTable, toast } from '../../components/index'
import { useConnection } from '../../lib/connection/connectionContext'
import { failureMessage } from '../../lib/connection/useServerAction'
import { rollMorale } from '../../lib/rules/opposition'
import { parseFrozenEntity } from '../../lib/schemas/frozenEntity'
import { useEntityStore } from '../../stores/entityStore'
import type { PlayReadOnly } from '../play.model'
import { mediatorTarget, playReadOnly } from '../play.model'
import { recordPlayRoll } from '../playRolls.model'
import type { PlayDowntime } from '../situation.model'
import type { AlertLine, CrewVitals, RollLine } from '../useGameFeed'
import { usePlayDowntime } from '../usePlayDowntime'
import { usePresenceClock } from '../usePresenceClock'
import type { MediatorSeat } from './mediatorTable.model'
import { mediatorSeats } from './mediatorTable.model'
import type { TrayWrites } from './OppositionPicker'
import type { SavedPattern, TrayNpc } from './opposition.model'
import { newTrayNpc, readSavedPattern, readTrayNpc } from './opposition.model'
import type { ProposeArgs } from './ProposeDock'
import type { SentProposal } from './proposalLine.model'

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
  /** The tray, hidden from players; null while it loads. */
  npcs: TrayNpc[] | null
  savedPatterns: SavedPattern[]
  tray: TrayWrites
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
  const patterns = useQuery(api.mediator.patterns, { gameId: id })
  const sent = useQuery(api.proposals.sent, { gameId: id, limit: sentLimit })
  const alerts = useQuery(api.proposals.alerts, { gameId: id, limit: FEED_ALERTS })
  const rolls = useQuery(api.changeLog.rolls, { gameId: id, limit: FEED_ROLLS })
  const downtime = usePlayDowntime(mediatorTarget(gameId))

  const addNpc = useMutation(api.mediator.addNpc)
  const updateNpc = useMutation(api.mediator.updateNpc)
  const removeNpc = useMutation(api.mediator.removeNpc)
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
  }

  return {
    gameId,
    gameName,
    seats: mediatorSeats(crew ?? null, seats ?? [], members ?? [], now),
    crew: crew ?? null,
    crawler:
      listing == null
        ? null
        : primaryCrawler(listing, (crawlerId) => store.get('crawler', crawlerId)),
    downtime,
    npcs: tray,
    savedPatterns: (patterns ?? []).flatMap((row) => readSavedPattern(row) ?? []),
    tray: trayWrites,
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
