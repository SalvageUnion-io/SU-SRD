import { runningFrom, splitWaves, trayNpcsFor, waveOf } from 'game-domain/games/encounters'
import type { RunningEncounter } from 'game-domain/schemas/encounter'
import { EncounterSchema, RunningEncounterSchema } from 'game-domain/schemas/encounter'
import { EncounterNpcSchema, MediatorRollResultSchema } from 'game-domain/schemas/encounterNpc'
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
const TrayBodySchema = EncounterNpcSchema.partial().extend({ name: EncounterNpcSchema.shape.name })

/** The fields a fight changes on a tray NPC. */
export type TrayPatch = {
  currentHp?: number
  conditions?: string[]
  name?: string
  lastMediatorRoll?: unknown
  /** Claim a downed wreck's salvage: refused once claimed, or while it still stands. */
  salvaged?: true
  important?: boolean
  /** The chassis's EP and Heat Capacity, frozen when it is marked important. */
  maxEp?: number
  heatCap?: number
  currentEp?: number
  currentHeat?: number
  lastImportantRoll?: unknown
}

export class GameOpposition {
  constructor(
    private readonly store: GameStore,
    private readonly newId: () => string
  ) {}

  tray(actor: string): Record<string, unknown>[] {
    const member = this.store.member(actor)
    if (member === null || !member.mediator) return []
    return this.store
      .rows('select body from tray order by added_at, id')
      .map((row) => fromJson<Record<string, unknown>>(row.body))
  }

  /** The tray as the socket's `opposition` records, for the Mediator only. */
  trayRecords(
    actor: string
  ): { appId: string; body: Record<string, unknown>; updatedAt: number }[] {
    const member = this.store.member(actor)
    if (member === null || !member.mediator) return []
    return this.store
      .rows('select id, body, updated_at from tray order by added_at, id')
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
        if (typeof next.currentHp === 'number' && next.currentHp > 0) {
          throw new RoomRefusal('Only a downed wreck can be salvaged')
        }
        next.salvaged = true
      }
      if (patch.lastImportantRoll !== undefined) {
        next.lastImportantRoll = MediatorRollResultSchema.parse(patch.lastImportantRoll)
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
        const hp = body.currentHp
        if (group?.id !== groupId || (typeof hp === 'number' && hp <= 0)) continue
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
  mediatorRecords(
    actor: string
  ): { appId: string; body: { running: RunningEncounter | null }; updatedAt: number }[] {
    if (!this.mediates(actor)) return []
    const running = this.running(actor)
    const updatedAt = running === null ? 0 : Date.parse(running.startedAt)
    return [{ appId: 'mediator', body: { running }, updatedAt }]
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
   * group; the rest wait on the running encounter for `bringInWave`.
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
      const fielded = waves
        ? trayNpcsFor(waves.first, this.names(), now, parsed.groups ?? [])
        : trayNpcsFor(parsed.opposition, this.names(), now)
      for (const npc of fielded) this.insert(TrayBodySchema.parse(npc), at)
      this.putRunning(runningFrom(parsed, now, waves ? { held: waves.held } : undefined))
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

  /** Stop running it: its notes leave Play, and what it fielded stays on the tray. */
  endEncounter(actor: string): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      this.store.rows('delete from running_encounter')
    })
  }

  /** The names on the tray, which a fielded NPC is named apart from. */
  private names(): string[] {
    return this.store
      .rows('select body from tray')
      .map((row) => fromJson<{ name?: unknown }>(row.body).name)
      .map((name) => (typeof name === 'string' ? name : ''))
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
