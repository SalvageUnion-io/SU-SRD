import { runningFrom, trayNpcsFor } from 'game-domain/games/encounters'
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
 * rules are `convex/mediator.ts`'s.
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
   * its conditions, its name, or the last Morale roll. A Morale result is
   * kept on the NPC only: the Game's feed is the crew's to read.
   */
  updateNpc(actor: string, npcId: string, patch: TrayPatch, at: number): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      const row = this.store.rows('select body from tray where id = ?', npcId)[0]
      if (row === undefined) throw new RoomRefusal('That NPC is no longer on the tray')
      const body = fromJson<Record<string, unknown>>(row.body)
      const next: Record<string, unknown> = { ...body }
      if (patch.currentHp !== undefined) {
        const max = typeof body.maxHp === 'number' ? body.maxHp : Number.POSITIVE_INFINITY
        next.currentHp = Math.min(Math.max(0, Math.round(patch.currentHp)), max)
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
      if (typeof body.updatedAt === 'string') next.updatedAt = new Date(at).toISOString()
      this.store.rows(
        'update tray set body = ?, updated_at = ? where id = ?',
        JSON.stringify(TrayBodySchema.parse(next)),
        at,
        npcId
      )
    })
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
   * Mediator's, read from their account room by the Worker and copied, never
   * moved. `clear` empties the tray first: their choice, made in a dialog
   * that names what it removes (ADR-007).
   */
  runEncounter(actor: string, encounter: unknown, clear: boolean, at: number): { added: number } {
    return this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      const parsed = EncounterSchema.parse(encounter)
      if (clear) this.store.rows('delete from tray')
      const taken = this.tray(actor).map((npc) => (typeof npc.name === 'string' ? npc.name : ''))
      const now = new Date(at).toISOString()
      const fielded = trayNpcsFor(parsed.opposition, taken, now)
      for (const npc of fielded) this.insert(TrayBodySchema.parse(npc), at)
      const body = RunningEncounterSchema.parse(runningFrom(parsed, now))
      this.store.rows(
        `insert into running_encounter (id, body) values (1, ?)
         on conflict(id) do update set body = excluded.body`,
        JSON.stringify(body)
      )
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
