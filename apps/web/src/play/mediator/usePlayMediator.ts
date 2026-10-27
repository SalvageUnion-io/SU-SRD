/**
 * usePlayMediator — everything the Mediator's Play screen reads and writes
 * (play.md §10), from one call in `PlayMediatorCockpit`, handed to every
 * column so all three read the same table.
 *
 * It reads the table live — the seats (`crew.vitals`, `seats.forGame`, in
 * `games.members` join order), the primary crawler (`entities.listForGame`;
 * the Mediator's store holds it, so its box is live), the Game's Downtime
 * (`usePlayDowntime`, as the Mediator), the tray (`mediator.npcs`, through
 * `useTableRead`, so the Game room serves it once it feeds the replica), the saved
 * patterns the picker may field, the proposals sent, the alerts, the
 * Game's rolls, its Scene's conditions (`useScene`) and the area being
 * salvaged — and makes the writes the Mediator holds: the Opposition, a
 * downed wreck's salvage into the crawler, the area, proposals (ADR-030 §4),
 * alerts and the Scene's conditions. It
 * writes nothing a player owns; a player's sheet is reached only by proposal.
 *
 * A Morale roll is kept on the NPC (`lastMediatorRoll`) and goes on Play's
 * roll log (`recordPlayRoll`), which keeps the Mediator's rolls off the
 * Game's log and posts one only when the Post toggle (private by default) or
 * the roll's own Post says so.
 */

import { dealCount } from 'game-domain/games/ledger'
import { PROPOSALS_PAGE } from 'game-domain/games/proposals'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Encounter, RunningEncounter } from 'game-domain/schemas/encounter'
import { RunningEncounterSchema } from 'game-domain/schemas/encounter'
import type { SceneConditionId } from 'game-domain/schemas/scene'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { dieForTable, rollD20, rollForTable, toast } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { useWorkerRead } from '../../lib/connection/workerRead'
import { flagOn } from '../../lib/flags'
import type { ImportantRoll } from '../../lib/rules/opposition'
import {
  criticalTable,
  groupTableName,
  npcHeatCheck,
  REACTOR_OVERLOAD,
  rollMorale,
  rollNpcCritical,
  rollReaction,
} from '../../lib/rules/opposition'
import { runWrite } from '../../lib/runWrite'
import { parseFrozenEntity } from '../../lib/schemas/frozenEntity'
import { sharedPaths } from '../../lib/sharing/paths'
import { mediatorCopy } from '../../messages/play-mediator'
import { useEncounters, usePatterns } from '../../replica/collections'
import { PLAY_TXN } from '../../replica/provenance'
import { useGamesQuery } from '../../replica/roomCalls'
import { useSync } from '../../replica/syncContext'
import { useUnits } from '../../replica/units'
import { useTableAct, useTableRead } from '../../replica/useTable'
import type { GameActResult } from '../../rooms/game/acts'
import type { PlayReadOnly } from '../play.model'
import { mediatorTarget, playReadOnly } from '../play.model'
import { recordPlayRoll } from '../playRolls.model'
import type { PlayDowntime } from '../situation.model'
import { useClock } from '../useClock'
import type { AlertLine, CrewVitals, RollLine } from '../useGameFeed'
import { useGamePresence } from '../useGamePresence'
import { usePlayDowntime } from '../usePlayDowntime'
import type { SalvageAreaView } from '../useSalvageArea'
import { useSalvageArea } from '../useSalvageArea'
import type { SceneState } from '../useScene'
import { useScene } from '../useScene'
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
  /** The Scene's conditions, and the Mediator's writes to them (`scenes.ts`). */
  scene: MediatorScene
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

/** The Scene's conditions as the Mediator sets them and passes the hours. */
type MediatorScene = SceneState & {
  /** Put the Scene under exactly these. */
  set: (conditions: readonly SceneConditionId[]) => Promise<void>
  /** Count an hour passed; resolves to the hour it now is. */
  passHour: () => Promise<number>
}

/** The Game's deal income: a Scrap per deal, collected once per Downtime at Upkeep. */
type DealIncome = {
  /** The factions the crew has a deal with; 0 while the ledger loads. */
  deals: number
  /** This Downtime's is collected. */
  collected: boolean
  /** Collect it into the crawler: what it paid, or null when it already was. */
  collect: () => Promise<GameActResult<'ledger.collectIncome'>>
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
  /** Bring a held-back wave onto the tray (ADR-059 §5). */
  bringIn: (wave: number) => Promise<{ added: number }>
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
  const id = gameId
  const connection = useSync()
  const { canWrite } = connection
  const here = useGamePresence(gameId, 'seat')
  const now = useClock()
  const store = useUnits()
  const [sentLimit, setSentLimit] = useState(PROPOSALS_PAGE)

  const members = useGamesQuery('games.members', { gameId: id })
  const crew = useTableRead('crew.vitals', { gameId })
  const seats = useTableRead('seats.forGame', { gameId })
  const listing = useGamesQuery('entities.listForGame', { gameId: id })
  const npcs = useTableRead('mediator.npcs', { gameId })
  const running = useTableRead('mediator.running', { gameId })
  const encounters = useEncounters((s) => s.encounters)
  // The Mediator's own patterns, from their replica, then those crewmates
  // shared with this Game, from the shared database.
  const ownPatterns = usePatterns((s) => s.mechPatterns)
  const gamePatterns = useWorkerRead<{ appId: string; body: unknown; madeBy: string }[]>(
    sharedPaths.gamePatterns(gameId)
  )
  const patterns = [
    ...ownPatterns.map((p) => ({ appId: p.id, body: p, madeBy: mediatorCopy('you') })),
    ...(gamePatterns ?? []),
  ]
  const sent = useTableRead('ops.sent', { gameId, limit: sentLimit })
  const alerts = useTableRead('changeLog.alerts', { gameId, limit: FEED_ALERTS })
  const rolls = useTableRead('changeLog.rolls', { gameId, limit: FEED_ROLLS })
  const downtime = usePlayDowntime(mediatorTarget(gameId))
  const sceneState = useScene(gameId)
  const area = useSalvageArea(mediatorTarget(gameId))
  const ledger = useTableRead('ledger.get', { gameId })
  const collectIncome = useTableAct('ledger.collectIncome', gameId)

  const addNpc = useTableAct('mediator.addNpc', gameId)
  const updateNpc = useTableAct('mediator.updateNpc', gameId)
  const removeNpc = useTableAct('mediator.removeNpc', gameId)
  const runEncounter = useTableAct('mediator.runEncounter', gameId)
  const endEncounter = useTableAct('mediator.endEncounter', gameId)
  const bringInWave = useTableAct('mediator.bringInWave', gameId)
  const recordGroupRoll = useTableAct('mediator.recordGroupRoll', gameId)
  const proposeMutation = useTableAct('ops.propose', gameId)
  const broadcastMutation = useTableAct('changeLog.broadcast', gameId)
  const setConditions = useTableAct('scenes.setConditions', gameId)
  const passHour = useTableAct('scenes.passHour', gameId)

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

  const npcId = (npc: TrayNpc) => npc.id

  const trayWrites: TrayWrites = {
    add: (schema, entity, draw) =>
      addNpc({
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
    groupRoll: async (group, table) => {
      const tableName = groupTableName(table)
      const roll = table === 'reaction' ? rollReaction : rollMorale
      const result = roll(await dieForTable(tableName), new Date().toISOString())
      if (result === null) throw new Error(`The ${tableName} table could not be read`)
      await recordGroupRoll({ groupId: group.id, roll: result })
      recordPlayRoll({
        tableName,
        rolls: [result.roll],
        label: `${group.name} · ${tableName}`,
        outcome: result.label ?? result.value,
      })
    },
    setImportant: (npc, important) =>
      updateNpc({
        npcId: npcId(npc),
        patch:
          important && npc.track?.reactor && npc.reactor === null
            ? {
                important,
                maxEp: npc.track.reactor.maxEp,
                heatCap: npc.track.reactor.heatCap,
                currentEp: npc.track.reactor.maxEp,
                currentHeat: 0,
              }
            : { important },
      }),
    setReactor: (npc, patch) => updateNpc({ npcId: npcId(npc), patch }),
    critical: async (npc) => {
      if (npc.track === null) return
      const tableName = criticalTable(npc.track.critical)?.name
      if (tableName === undefined) throw new Error('The Critical table could not be read')
      const rolled = rollNpcCritical(
        npc.track.critical,
        await dieForTable(tableName),
        new Date().toISOString()
      )
      if (rolled === null) throw new Error('The Critical table could not be read')
      await updateNpc({
        npcId: npcId(npc),
        patch: {
          lastImportantRoll: rolled.result,
          ...(rolled.nextHp === null ? {} : { currentHp: rolled.nextHp }),
        },
      })
      recordPlayRoll({
        tableName,
        rolls: [rolled.result.roll],
        label: `${npc.name} · ${tableName}`,
        outcome: rolled.result.label ?? rolled.result.value,
      })
    },
    heatCheck: async (npc) => {
      if (npc.reactor === null) return
      const overloadTable = SalvageUnionReference.RollTables.getBySlug(REACTOR_OVERLOAD)?.name
      if (overloadTable === undefined) throw new Error('The overload table could not be read')
      // The check's own d20 is plain; the overload roll is the table's.
      const roll = await rollForTable(overloadTable, { plainD20s: 1 })
      const now = new Date().toISOString()
      const checked = npcHeatCheck(npc.reactor.heat, npc.currentHp, roll, now)
      if (checked === null) throw new Error('The overload table could not be read')
      const { overload } = checked
      const result: ImportantRoll = {
        table: 'heat-check',
        roll: checked.roll,
        label: overload?.label ?? mediatorCopy('passed'),
        value:
          overload === null
            ? mediatorCopy('heatCheckPassed', { roll: checked.roll, heat: checked.heat })
            : mediatorCopy('heatCheckOverload', {
                roll: checked.roll,
                heat: checked.heat,
                table: overloadTable,
                overload: overload.roll,
                value: overload.value,
              }),
        rolledAt: now,
      }
      await updateNpc({
        npcId: npcId(npc),
        patch: {
          lastImportantRoll: result,
          ...(checked.nextSp === npc.currentHp ? {} : { currentHp: checked.nextSp }),
        },
      })
      const heatCheck = mediatorCopy('heatCheck')
      recordPlayRoll({
        tableName: heatCheck,
        rolls: overload === null ? [checked.roll] : [checked.roll, overload.roll],
        label: `${npc.name} · ${heatCheck}`,
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
          await addNpc({ body })
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
    seats: mediatorSeats(crew ?? null, seats ?? [], members ?? [], here),
    crew: crew ?? null,
    crawler,
    downtime,
    scene: {
      ...sceneState,
      set: said(async (conditions: readonly SceneConditionId[]) => {
        await setConditions({ conditions: [...conditions] })
      }),
      passHour: async () => {
        try {
          return await passHour({})
        } catch (err) {
          onFailure(err)
          throw err
        }
      },
    },
    income: {
      deals: ledger ? dealCount(ledger) : 0,
      collected: ledger?.incomeCollected ?? false,
      collect: () => collectIncome({}),
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
      run: (encounterId, clear) =>
        runEncounter({
          // A Game room cannot read the Mediator's shelf: their own copy rides along.
          encounter: encounters.find((e) => e.id === encounterId),
          clear,
          ...(flagOn('encounterSheet') ? { waves: true } : {}),
        }),
      bringIn: (wave) => bringInWave({ wave }),
      end: async () => {
        await endEncounter({})
      },
    },
    sent: sent ?? null,
    sentLimit,
    moreSent: () => setSentLimit((n) => n + PROPOSALS_PAGE),
    propose: said(async (args: ProposeArgs) => {
      await proposeMutation(args)
    }),
    broadcast: said(async (message: string) => {
      await broadcastMutation({ message })
    }),
    alerts: alerts ?? [],
    rolls: rolls ?? null,
    onFailure,
    now,
    canWrite,
    readOnly: playReadOnly(connection),
  }
}
