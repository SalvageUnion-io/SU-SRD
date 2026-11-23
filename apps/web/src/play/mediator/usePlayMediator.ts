/**
 * usePlayMediator — everything the Mediator's Play screen reads and writes
 * (play.md §10), from one call in `PlayMediatorCockpit`, handed to every
 * column so all three read the same table.
 *
 * It reads the table live — the seats (`crew.vitals`, `seats.forGame`, in
 * `games.members` join order), the primary crawler (`useGameListing`;
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
 * roll log (`recordPlayRoll`), which writes each to the Game's log and posts
 * it to the bound Discord channel, unless Private rolls is on (ADR-051 §9a).
 */

import type { SalvageOffer } from 'game-domain/games/proposals'
import { CARGO_PROPOSAL_FIELD, PROPOSALS_PAGE } from 'game-domain/games/proposals'
import type { CargoLot } from 'game-domain/schemas/cargoLot'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Encounter, RunningEncounter } from 'game-domain/schemas/encounter'
import { RunningEncounterSchema } from 'game-domain/schemas/encounter'
import type { Npc } from 'game-domain/schemas/npc'
import type { SceneConditionId } from 'game-domain/schemas/scene'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { dieForTable, rollD20, rollForTable, toast } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { useWorkerRead } from '../../lib/connection/workerRead'
import { useOwnUnits } from '../../lib/entities/entities'
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
import { parseFrozenEntity } from '../../lib/schemas/frozenEntity'
import { sharedPaths } from '../../lib/sharing/paths'
import { mediatorCopy } from '../../messages/play-mediator'
import { useEncounters, usePatterns } from '../../replica/collections'
import { useGameListing } from '../../replica/gameListing'
import { PLAY_TXN } from '../../replica/provenance'
import { useSync } from '../../replica/syncContext'
import { useUnits } from '../../replica/units'
import { useTableAct, useTableRead } from '../../replica/useTable'
import type { TableEvent } from '../../rooms/game/events'
import { gameEncounters } from '../games/prep/gamePrep.model'
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
import {
  firstToNumber,
  newBuiltTrayNpc,
  newTrayNpc,
  readSavedPattern,
  readTrayNpc,
} from './opposition.model'
import type { ProposeArgs } from './ProposeDock'
import type { SentProposal } from './proposalLine.model'
import { useWithdrawProposal } from './useWithdrawProposal'

/** A wreck's salvage that hauls nothing: it is settled, and nothing is written. */
export const NOTHING = (): null => null

/**
 * Where a wreck's haul goes: the crawler's hold and pool (a patch of it as it
 * stands), or a crew Mech's hold (r5 B2), as a proposal its player accepts
 * (ADR-030 §4: the Mediator never writes a player's sheet).
 */
export type WreckHaul =
  | ((crawler: Crawler) => Partial<Crawler> | null)
  | {
      /** The crew Mech whose hold it is proposed to, or null for the crawler's (r7 D8). */
      mechId: string | null
      lots: CargoLot[]
      reason: string
      /** What the answer may pick from instead (`WRECK_SALVAGE`, r7 D8). */
      offer?: SalvageOffer
    }

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
  /** The tray, hidden from players; null while it loads. */
  npcs: TrayNpc[] | null
  savedPatterns: SavedPattern[]
  /** The Mediator's own designed NPCs, for the picker's Yours. */
  ownNpcs: Npc[]
  tray: TrayWrites
  /**
   * Settle a downed wreck's salvage: claim it (`salvaged`, once), then write
   * `haul`'s patch of the crawler as it stands, or propose its lots to a crew
   * Mech's hold. `NOTHING` settles a wreck that yields nothing; a crawler
   * haul is refused with no crawler the Mediator holds.
   */
  salvageWreck: (npc: TrayNpc, haul: WreckHaul) => Promise<void>
  /** The area the crew is salvaging, which the Mediator names (Core Book p.245). */
  area: SalvageAreaView
  /** The Mediator's prep (ADR-059): their encounters, and the one this Game is running. */
  prep: MediatorPrep
  /** Newest first; null while the first answer is on its way. */
  sent: SentProposal[] | null
  sentLimit: number
  moreSent: () => void
  propose: (args: ProposeArgs) => Promise<void>
  /** Take back a proposal still awaiting its answer (r2 C7). */
  withdraw: (opId: string) => void
  broadcast: (message: string) => Promise<void>
  /** Take an alert back off every player's strip and Feed (r4 B4); a refusal is said. */
  withdrawAlert: (alertId: string) => void
  alerts: AlertLine[]
  rolls: RollLine[] | null
  /** The table's event stream (`changeLog.events`); null while it loads. */
  events: TableEvent[] | null
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
  /** Mark whose turn it is, or nobody's with null. */
  setUpNow: (pilotId: string | null) => Promise<void>
}

/** The Mediator's encounters, and the one the Game is running (ADR-059). */
type MediatorPrep = {
  /** Theirs, from their shelf; a Game runs a copy, never holds one. */
  encounters: Encounter[]
  /** The one running; null when none is (or while it loads). */
  running: RunningEncounter | null
  /** Run one: its opposition joins the tray (`clear` empties the tray first). */
  /** `startSession` false: a test run, no group session started for it (r7 C6). */
  run: (encounterId: string, clear: boolean, startSession?: boolean) => Promise<{ added: number }>
  /** Stop running it: its notes and tables leave Play; the Opposition stays unless `clear`. */
  end: (clear?: boolean) => Promise<void>
  /** Bring a held-back wave onto the tray (ADR-059 §5). */
  bringIn: (wave: number) => Promise<{ added: number }>
}

/** A running encounter as the server keeps it, or null when it does not read. */
/** The group a roster line's copies fight in (r6 B5): one id, named for what they are. */
function lineGroup(entity: { name?: unknown }): { id: string; name: string } {
  const name = typeof entity.name === 'string' && entity.name.trim() !== '' ? entity.name : 'Group'
  return { id: crypto.randomUUID(), name: name.trim().slice(0, 40) }
}

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
  const ownNpcs = useOwnUnits('npc')
  const [sentLimit, setSentLimit] = useState(PROPOSALS_PAGE)

  const members = useTableRead('games.members', { gameId })
  const crew = useTableRead('crew.vitals', { gameId })
  const seats = useTableRead('seats.forGame', { gameId })
  const listing = useGameListing(id)
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
  const events = useTableRead('changeLog.events', { gameId })
  const downtime = usePlayDowntime(mediatorTarget(gameId))
  const sceneState = useScene(gameId)
  const area = useSalvageArea(mediatorTarget(gameId))

  const addNpc = useTableAct('mediator.addNpc', gameId)
  const updateNpc = useTableAct('mediator.updateNpc', gameId)
  const removeNpc = useTableAct('mediator.removeNpc', gameId)
  const runEncounter = useTableAct('mediator.runEncounter', gameId)
  const endEncounter = useTableAct('mediator.endEncounter', gameId)
  const clearTray = useTableAct('mediator.clearTray', gameId)
  const bringInWave = useTableAct('mediator.bringInWave', gameId)
  const recordGroupRoll = useTableAct('mediator.recordGroupRoll', gameId)
  const proposeMutation = useTableAct('ops.propose', gameId)
  const withdraw = useWithdrawProposal(gameId)
  const broadcastMutation = useTableAct('changeLog.broadcast', gameId)
  const withdrawAlert = useTableAct('changeLog.withdrawAlert', gameId)
  const setConditions = useTableAct('scenes.setConditions', gameId)
  const passHour = useTableAct('scenes.passHour', gameId)
  const setUpNow = useTableAct('scenes.setUpNow', gameId)

  const tray = npcs?.map(readTrayNpc) ?? null

  /** A refusal reads as the server's own words; anything else is reported. */
  const onFailure = (err: unknown) => {
    toast.error(failureMessage(err, mediatorCopy('didNotReachTheTable')), {
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

  /**
   * Field one, then number the first of its kind ("Raider" reads "Raider 1"
   * once "Raider 2" is out, r4 D5). `out` is who is on the field, kept in step.
   */
  const fieldNpc = async (
    body: ReturnType<typeof newTrayNpc>,
    out: { id: string; name: string }[] = (tray ?? []).map(({ id, name }) => ({ id, name }))
  ) => {
    const id = await addNpc({ body })
    const first = firstToNumber(out, body.name)
    out.push({ id: typeof id === 'string' ? id : '', name: body.name })
    // One the room did not name back cannot be renamed: it keeps its name.
    if (first === null || first.npc.id === '') return
    await updateNpc({ npcId: first.npc.id, patch: { name: first.name } })
    first.npc.name = first.name
  }

  const trayWrites: TrayWrites = {
    add: (schema, entity, draw) =>
      fieldNpc(
        newTrayNpc(
          schema,
          entity,
          (tray ?? []).map((n) => n.name),
          new Date().toISOString(),
          draw
        )
      ),
    setHp: (npc, next) => updateNpc({ npcId: npcId(npc), patch: { currentHp: next } }),
    salvageRoll: (npc, roll) =>
      updateNpc({
        npcId: npcId(npc),
        patch: { salvageRoll: { roll, rolledAt: new Date().toISOString() } },
      }),
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
        veiled: true,
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
        veiled: true,
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
        veiled: true,
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
        veiled: true,
        outcome: result.label ?? result.value,
      })
    },
    remove: (npc) => removeNpc({ npcId: npcId(npc) }),
    clear: () => clearTray({}),
    clearDowned: async () => {
      // The rows as the room keeps them, so Undo puts each back whole, its id kept.
      const downed = (npcs ?? []).filter((row) => readTrayNpc(row).down)
      for (const row of downed) await removeNpc({ npcId: row._id })
      return {
        removed: downed.length,
        undo: async () => {
          for (const row of downed) await addNpc({ body: row.body })
        },
      }
    },
    addBuilt: (npc, name) =>
      fieldNpc(
        newBuiltTrayNpc(
          npc,
          (tray ?? []).map((n) => n.name),
          new Date().toISOString(),
          name
        )
      ),
    rename: (npc, name) => updateNpc({ npcId: npcId(npc), patch: { name } }),
    field: async (lines) => {
      // One at a time, each name counted against the ones before it, so four
      // Contour Hussars come out numbered.
      const out = (tray ?? []).map(({ id, name }) => ({ id, name }))
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
            veiled: true,
            outcome: `${count}`,
          })
        }
        // Two or more from one line fight as a group (r6 B5, Core Book p.268).
        const group = count > 1 ? lineGroup(entity) : undefined
        for (let i = 0; i < count; i++) {
          const body = newTrayNpc(
            schema,
            entity,
            out.map((n) => n.name),
            new Date().toISOString(),
            pattern ? { pattern } : {}
          )
          await fieldNpc(group === undefined ? body : { ...body, group }, out)
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
      // A marker: a refusal is said, and nothing waits on it.
      setUpNow: async (pilotId: string | null) => {
        try {
          await setUpNow({ pilotId })
        } catch (err) {
          onFailure(err)
        }
      },
      passHour: async () => {
        try {
          return await passHour({})
        } catch (err) {
          onFailure(err)
          throw err
        }
      },
    },
    npcs: tray,
    ownNpcs,
    savedPatterns: (patterns ?? []).flatMap((row) => readSavedPattern(row) ?? []),
    tray: trayWrites,
    salvageWreck: said(async (npc: TrayNpc, haul: WreckHaul) => {
      if (typeof haul !== 'function') {
        // Offered to the crew, it is proposed to the Game's crawler (r7 D8).
        const entityId = haul.mechId ?? crawler?.crawler.id ?? null
        if (entityId === null) throw new Error('There is no crawler to haul it to')
        await updateNpc({ npcId: npcId(npc), patch: { salvaged: true } })
        await proposeMutation({
          entityId,
          field: CARGO_PROPOSAL_FIELD,
          after: haul.lots,
          reason: haul.reason,
          ...(haul.offer === undefined ? {} : { offer: haul.offer }),
        })
        return
      }
      const held = crawler?.held ? crawler.crawler : null
      const patch = held === null ? null : haul(store.get('crawler', held.id) ?? held)
      if (held === null && haul !== NOTHING) throw new Error('There is no crawler to haul it to')
      // Claimed first, as a Downtime step is: a second press never pays twice.
      // A wreck that yields nothing is settled too: what was left is destroyed.
      // The haul is awaited, so a refused write is said rather than lost.
      await updateNpc({ npcId: npcId(npc), patch: { salvaged: true } })
      if (held !== null && patch !== null) {
        await store.update('crawler', held.id, patch, PLAY_TXN)
      }
    }),
    area,
    prep: {
      // This Game's first, in the order its Prep keeps (ADR-067 §3); then the rest.
      encounters: [
        ...gameEncounters(encounters, gameId),
        ...encounters.filter((e) => e.gameId !== gameId),
      ],
      running: running == null ? null : readRunning(running),
      run: (encounterId, clear, startSession = true) =>
        runEncounter({
          // A Game room cannot read the Mediator's shelf: their own copy rides along.
          encounter: encounters.find((e) => e.id === encounterId),
          clear,
          ...(flagOn('encounterSheet') ? { waves: true } : {}),
          ...(startSession ? {} : { startSession: false }),
        }),
      bringIn: (wave) => bringInWave({ wave }),
      end: async (clear = false) => {
        await endEncounter(clear ? { clear: true } : {})
      },
    },
    sent: sent ?? null,
    sentLimit,
    moreSent: () => setSentLimit((n) => n + PROPOSALS_PAGE),
    propose: said(async (args: ProposeArgs) => {
      await proposeMutation(args)
    }),
    withdraw,
    broadcast: said(async (message: string) => {
      await broadcastMutation({ message })
    }),
    withdrawAlert: (alertId: string) => {
      withdrawAlert({ alertId }).catch(onFailure)
    },
    alerts: alerts ?? [],
    rolls: rolls ?? null,
    events: events ?? null,
    onFailure,
    now,
    canWrite,
    readOnly: playReadOnly(connection),
  }
}
