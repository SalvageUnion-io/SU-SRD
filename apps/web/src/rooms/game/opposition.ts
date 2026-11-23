import {
  preppedOrder,
  runningFrom,
  splitWaves,
  trayNpcsFor,
  waveOf,
} from 'game-domain/games/encounters'
import type { RunningEncounter } from 'game-domain/schemas/encounter'
import { EncounterSchema, RunningEncounterSchema } from 'game-domain/schemas/encounter'
import { EncounterNpcSchema, MediatorRollResultSchema } from 'game-domain/schemas/encounterNpc'
import { z } from 'salvageunion-reference/zod'
import type { Initiative } from '../../lib/rules/initiative'
import { InitiativeSchema, withActed } from '../../lib/rules/initiative'
import { groupedInOneGo, isDown } from '../../lib/rules/opposition'
import { RoomRefusal } from '../refusal'
import type { GameStore } from './store'
import { fromJson } from './store'

/**
 * The Mediator's Opposition tray and the encounter the Game is running
 * (ADR-034 decision 2, ADR-059): the one part of a Game the crew cannot read,
 * so every read and write here is the Mediator's alone (ADR-030 §5). The
 * rules are the Mediator's.
 */

/**
 * What the tray stores: any part of an instance, `.strict()`, with its name.
 * Rows written before the full instance carry only a name, and an update
 * re-parses them, so the whole record is not demanded.
 */
/** The encounters run here (`ran`), by id: the newest this many are kept. */
const RAN_KEPT = 200
const RAN = z.array(z.string())

const TrayBodySchema = EncounterNpcSchema.partial().extend({ name: EncounterNpcSchema.shape.name })

/** A wreck's kept Mech Salvage roll, as the record holds it. */
const SalvageRollSchema = EncounterNpcSchema.shape.salvageRoll.unwrap()

/** The fields a fight changes on a tray NPC. */
export type TrayPatch = {
  currentHp?: number
  conditions?: string[]
  name?: string
  lastMediatorRoll?: unknown
  /** Claim a downed wreck's salvage: refused once claimed, or while it still stands. */
  salvaged?: true
  /** A downed Mech's Mech Salvage roll, kept until it is salvaged (r5 B1). */
  salvageRoll?: unknown
  important?: boolean
  /** The chassis's EP and Heat Capacity, frozen when it is marked important. */
  maxEp?: number
  heatCap?: number
  currentEp?: number
  currentHeat?: number
  lastImportantRoll?: unknown
  /** Uses spent, by action id: merged into what the unit has spent (r8 B3). */
  usesSpent?: Record<string, number>
  /** Titanic Actions spent this round (r8 B3). */
  titanicSpent?: unknown
}

/** A unit's spent Uses, as the record holds them. */
const UsesSpentSchema = EncounterNpcSchema.shape.usesSpent.unwrap()

/** A Bio-Titan's spent Titanic Actions, as the record holds them. */
const TitanicSpentSchema = EncounterNpcSchema.shape.titanicSpent.unwrap()

export class GameOpposition {
  constructor(
    private readonly store: GameStore,
    private readonly newId: () => string
  ) {}

  tray(actor: string): Record<string, unknown>[] {
    const member = this.store.member(actor)
    if (member === null || !member.mediator) return []
    return this.store
      .rows('select body from tray order by added_at, rowid')
      .map((row) => fromJson<Record<string, unknown>>(row.body))
  }

  /** The tray as the socket's `opposition` records, for the Mediator only. */
  trayRecords(
    actor: string
  ): { appId: string; body: Record<string, unknown>; updatedAt: number }[] {
    const member = this.store.member(actor)
    if (member === null || !member.mediator) return []
    return this.store
      .rows('select id, body, updated_at from tray order by added_at, rowid')
      .map((row) => ({
        appId: String(row.id),
        body: fromJson<Record<string, unknown>>(row.body),
        updatedAt: Number(row.updated_at),
      }))
  }

  /** Put an NPC on the tray. Its id is its address: kept when it has one, minted when not. */
  addNpc(actor: string, body: unknown, at: number): string {
    return this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      return this.insert(TrayBodySchema.parse(body), at)
    })
  }

  removeNpc(actor: string, npcId: string): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      this.store.rows('delete from tray where id = ?', npcId)
    })
  }

  /**
   * Change a tray NPC as the fight goes: HP or SP held to 0 and its own max,
   * EP to its `maxEp` and Heat to its `heatCap`, its conditions, its name, the
   * last Morale roll, what it tracks as an important NPC (Workshop Manual
   * p.255), or the claim on its wreck once it is down. A Morale result is kept
   * on the NPC only: the Game's feed is the crew's to read.
   */
  updateNpc(actor: string, npcId: string, patch: TrayPatch, at: number): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      const row = this.store.rows('select body from tray where id = ?', npcId)[0]
      if (row === undefined) throw new RoomRefusal('That NPC is no longer on the tray')
      const body = fromJson<Record<string, unknown>>(row.body)
      const next: Record<string, unknown> = { ...body }
      const clampTo = (value: number, max: unknown) =>
        Math.min(Math.max(0, Math.round(value)), typeof max === 'number' ? max : Infinity)
      if (patch.currentHp !== undefined) next.currentHp = clampTo(patch.currentHp, body.maxHp)
      if (patch.important !== undefined) next.important = patch.important
      if (patch.maxEp !== undefined) next.maxEp = clampTo(patch.maxEp, Infinity)
      if (patch.heatCap !== undefined) next.heatCap = clampTo(patch.heatCap, Infinity)
      if (patch.currentEp !== undefined) next.currentEp = clampTo(patch.currentEp, next.maxEp)
      if (patch.currentHeat !== undefined) {
        next.currentHeat = clampTo(patch.currentHeat, next.heatCap)
      }
      if (patch.conditions !== undefined) next.conditions = patch.conditions
      if (patch.name !== undefined) {
        const name = patch.name.trim()
        if (name.length === 0) throw new RoomRefusal('An NPC needs a name')
        next.name = name
      }
      if (patch.lastMediatorRoll !== undefined) {
        next.lastMediatorRoll = MediatorRollResultSchema.parse(patch.lastMediatorRoll)
      }
      if (patch.salvaged !== undefined) {
        // Claimed before the haul is written: a second press never pays out the same wreck twice.
        if (body.salvaged === true) throw new RoomRefusal('That wreck is already salvaged')
        if (!trayNpcDown(next)) {
          throw new RoomRefusal('Only a downed wreck can be salvaged')
        }
        next.salvaged = true
      }
      if (patch.salvageRoll !== undefined) {
        if (body.salvaged === true) throw new RoomRefusal('That wreck is already salvaged')
        if (!trayNpcDown(next)) throw new RoomRefusal('Only a downed wreck can be salvaged')
        next.salvageRoll = SalvageRollSchema.parse(patch.salvageRoll)
      }
      if (patch.lastImportantRoll !== undefined) {
        next.lastImportantRoll = MediatorRollResultSchema.parse(patch.lastImportantRoll)
      }
      if (patch.usesSpent !== undefined) {
        const kept = UsesSpentSchema.safeParse(body.usesSpent)
        next.usesSpent = {
          ...(kept.success ? kept.data : {}),
          ...UsesSpentSchema.parse(patch.usesSpent),
        }
      }
      if (patch.titanicSpent !== undefined) {
        next.titanicSpent = TitanicSpentSchema.parse(patch.titanicSpent)
      }
      this.write(npcId, next, at)
    })
  }

  /**
   * One roll for a whole group (Core Book p.267-268): Reaction when the
   * Pilots meet it, Morale when half of it falls. Kept on each member still
   * standing, as each NPC keeps its own last roll.
   */
  recordGroupRoll(actor: string, groupId: string, roll: unknown, at: number): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      const result = MediatorRollResultSchema.parse(roll)
      for (const row of this.store.rows('select id, body from tray')) {
        const body = fromJson<Record<string, unknown>>(row.body)
        const group = body.group as { id?: unknown } | undefined
        if (group?.id !== groupId || trayNpcDown(body)) continue
        this.write(String(row.id), { ...body, lastMediatorRoll: result }, at)
      }
    })
  }

  /** Whether `actor` mediates this Game: what the Mediator's Play is gated on. */
  mediates(actor: string): boolean {
    return this.store.member(actor)?.mediator === true
  }

  /**
   * The socket's one `mediator` record, for the Mediator only: the encounter
   * being run, or null. A reader without it does not mediate here.
   */
  mediatorRecords(actor: string): {
    appId: string
    body: { running: RunningEncounter | null; initiative: Initiative | null; ran?: string[] }
    updatedAt: number
  }[] {
    if (!this.mediates(actor)) return []
    const running = this.running(actor)
    const kept = this.initiativeRow()
    const ran = this.ranRow()
    const updatedAt = Math.max(
      running === null ? 0 : Date.parse(running.startedAt),
      kept?.at ?? 0,
      ran?.at ?? 0
    )
    const body = { running, initiative: kept?.initiative ?? null }
    return [
      {
        appId: 'mediator',
        body: ran === null || ran.ids.length === 0 ? body : { ...body, ran: ran.ids },
        updatedAt,
      },
    ]
  }

  /**
   * The encounters run at this table, by id, first run first (r8 B8): the
   * Run dialog offers the first one not yet run. The Mediator's alone.
   */
  ran(actor: string): string[] {
    if (!this.mediates(actor)) return []
    return this.ranRow()?.ids ?? []
  }

  /** The Group Initiative tracker (r6 B4), for the Mediator; null when none is kept. */
  initiative(actor: string): Initiative | null {
    if (!this.mediates(actor)) return null
    return this.initiativeRow()?.initiative ?? null
  }

  /**
   * Keep the tracker as the Mediator moved it, or end it with null: a tracker
   * only, which refuses no turn (ARCHITECTURE.md#combat). One `change_log`
   * row (field `initiative`), kept when ended so the record reads newer.
   */
  setInitiative(actor: string, initiative: unknown, at: number): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      this.putInitiative(initiative === null ? null : InitiativeSchema.parse(initiative), at)
    })
  }

  /**
   * A pilot's turn ended (they ended it, or the turn was given to another):
   * their mark fills, while a tracker is kept. Nothing else moves.
   */
  markActed(pilotId: string, at: number): void {
    const kept = this.initiativeRow()?.initiative ?? null
    if (kept === null || kept.acted.includes(pilotId)) return
    this.putInitiative(withActed(kept, pilotId, true), at)
  }

  /** The table got up, or Downtime began: no action scene, so no tracker. */
  endInitiative(at: number): void {
    if ((this.initiativeRow()?.initiative ?? null) === null) return
    this.putInitiative(null, at)
  }

  /**
   * The table changed hands to `to` (r6 B1): the running encounter goes
   * across without its notes, which are the old Mediator's ("Only you") and
   * stay on their own encounter in Prep. Its name, briefing, tables and
   * waves are the table's, so they stay. Called after `to` is appointed;
   * nothing changes when they already mediated.
   */
  handOver(to: string, wasMediator: boolean): void {
    if (wasMediator || !this.mediates(to)) return
    const running = this.running(to)
    if (running === null || running.notes === '') return
    this.putRunning({ ...running, notes: '' })
  }

  /** The encounter being run, or null. */
  running(actor: string): RunningEncounter | null {
    const member = this.store.member(actor)
    if (member === null || !member.mediator) return null
    const row = this.store.rows('select body from running_encounter where id = 1')[0]
    return row === undefined ? null : fromJson<RunningEncounter>(row.body)
  }

  /**
   * Run one of the Mediator's encounters here (ADR-059): its opposition joins
   * the tray at full HP or SP, named apart from what is there, and its name,
   * tables and notes become the running encounter. The encounter is the
   * Mediator's own, sent from their replica (a Game room cannot read an
   * account room's shelf) and copied, never moved. `clear` empties the tray
   * first: their choice, made in a dialog that names what it removes
   * (ADR-007). `waves` fields only the first wave, each opponent with its
   * group; the rest wait on the running encounter for `bringInWave`. Two or
   * more of one kind in no group form one (`groupedInOneGo`, r6 B5).
   */
  runEncounter(
    actor: string,
    encounter: unknown,
    options: { clear: boolean; waves?: boolean },
    at: number
  ): { added: number } {
    return this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      const parsed = EncounterSchema.parse(encounter)
      if (options.clear) this.store.rows('delete from tray')
      const now = new Date(at).toISOString()
      const waves = options.waves === true ? splitWaves(parsed) : null
      const fielded = groupedInOneGo(
        waves
          ? trayNpcsFor(waves.first, this.names(), now, parsed.groups ?? [])
          : trayNpcsFor(preppedOrder(parsed), this.names(), now),
        this.newId
      )
      for (const npc of fielded) this.insert(TrayBodySchema.parse(npc), at)
      this.putRunning(runningFrom(parsed, now, waves ? { held: waves.held } : undefined))
      this.keepRan(parsed.id, at)
      return { added: fielded.length }
    })
  }

  /**
   * Bring a held-back wave of the running encounter onto the tray (ADR-059
   * §5): each opponent with its group, at full HP or SP, named apart from
   * what is there. The Mediator's tap: nothing arrives on its own.
   */
  bringInWave(actor: string, wave: number, at: number): { added: number } {
    return this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      const running = this.running(actor)
      if (running === null) throw new RoomRefusal('No encounter is running')
      const groups = running.groups ?? []
      const held = running.held ?? []
      const arriving = held.filter((o) => waveOf(o, groups) === wave)
      if (arriving.length === 0) throw new RoomRefusal('That wave is already in')
      const fielded = trayNpcsFor(arriving, this.names(), new Date(at).toISOString(), groups)
      for (const npc of fielded) this.insert(TrayBodySchema.parse(npc), at)
      const { held: _held, ...rest } = running
      const left = held.filter((o) => waveOf(o, groups) !== wave)
      this.putRunning(left.length === 0 ? rest : { ...rest, held: left })
      return { added: fielded.length }
    })
  }

  /**
   * Stop running it: its notes leave Play, and what it fielded stays on the
   * tray unless the Mediator chose to clear the field with it (`clear`, their
   * choice in a dialog that counts what goes, ADR-007).
   */
  endEncounter(actor: string, options: { clear?: boolean } = {}): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      this.store.rows('delete from running_encounter')
      if (options.clear === true) this.store.rows('delete from tray')
    })
  }

  /** Clear the field: every NPC leaves the tray at once. The running encounter stays. */
  clearTray(actor: string): { removed: number } {
    return this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      const removed = this.store.rows('select id from tray').length
      this.store.rows('delete from tray')
      return { removed }
    })
  }

  /** The names on the tray, which a fielded NPC is named apart from. */
  private names(): string[] {
    return this.store
      .rows('select body from tray')
      .map((row) => fromJson<{ name?: unknown }>(row.body).name)
      .map((name) => (typeof name === 'string' ? name : ''))
  }

  private initiativeRow(): { initiative: Initiative | null; at: number } | null {
    const row = this.store.rows("select after, ts from change_log where field = 'initiative'")[0]
    if (row === undefined) return null
    const kept = InitiativeSchema.nullable().safeParse(fromJson<unknown>(row.after))
    return { initiative: kept.success ? kept.data : null, at: Number(row.ts) }
  }

  private putInitiative(initiative: Initiative | null, at: number): void {
    this.store.rows("delete from change_log where field = 'initiative'")
    this.store.rows(
      'insert into change_log (id, field, after, source, actor_id, ts) values (?, ?, ?, ?, ?, ?)',
      'initiative',
      'initiative',
      JSON.stringify(initiative),
      'mediator-initiative',
      null,
      at
    )
  }

  private ranRow(): { ids: string[]; at: number } | null {
    const row = this.store.rows("select after, ts from change_log where field = 'ran'")[0]
    if (row === undefined) return null
    const kept = RAN.safeParse(fromJson<unknown>(row.after))
    return { ids: kept.success ? kept.data : [], at: Number(row.ts) }
  }

  /** One `change_log` row (field `ran`), as `initiative` is: each id once, the newest kept. */
  private keepRan(encounterId: string, at: number): void {
    const ids = this.ranRow()?.ids ?? []
    if (ids.includes(encounterId)) return
    this.store.rows("delete from change_log where field = 'ran'")
    this.store.rows(
      'insert into change_log (id, field, after, source, actor_id, ts) values (?, ?, ?, ?, ?, ?)',
      'ran',
      'ran',
      JSON.stringify([...ids, encounterId].slice(-RAN_KEPT)),
      'mediator-ran',
      null,
      at
    )
  }

  private putRunning(running: RunningEncounter): void {
    this.store.rows(
      `insert into running_encounter (id, body) values (1, ?)
       on conflict(id) do update set body = excluded.body`,
      JSON.stringify(RunningEncounterSchema.parse(running))
    )
  }

  /** A tray NPC's new body, parsed, stamped when it carries its own stamp. */
  private write(npcId: string, body: Record<string, unknown>, at: number): void {
    const next =
      typeof body.updatedAt === 'string' ? { ...body, updatedAt: new Date(at).toISOString() } : body
    this.store.rows(
      'update tray set body = ?, updated_at = ? where id = ?',
      JSON.stringify(TrayBodySchema.parse(next)),
      at,
      npcId
    )
  }

  private insert(body: Record<string, unknown>, at: number): string {
    const id = typeof body.id === 'string' && body.id.length > 0 ? body.id : this.newId()
    this.store.rows(
      'insert into tray (id, body, added_at, updated_at) values (?, ?, ?, ?)',
      id,
      JSON.stringify({ ...body, id }),
      at,
      at
    )
    return id
  }
}

/** A tray NPC is down as the Mediator's screen reads it (`isDown`): unset HP is full. */
function trayNpcDown(body: Record<string, unknown>): boolean {
  const maxHp = typeof body.maxHp === 'number' ? body.maxHp : 0
  return isDown(typeof body.currentHp === 'number' ? body.currentHp : maxHp, maxHp)
}
