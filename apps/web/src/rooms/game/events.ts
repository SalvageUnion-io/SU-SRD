import { fieldLabel } from 'game-domain/games/proposals'
import type { LinkShape } from 'game-domain/links/linkRules'
import { seatOf } from '../seats'
import { unsetVital } from '../vitals'
import type { GameActName } from './acts'
import type { Stored } from './eventLines'
import {
  CONDITION_WORDS,
  CONDITIONS,
  crewedLabel,
  effectName,
  eventOf,
  mergeLine,
  signedBy,
  UNDO_SOURCE,
  VITALS,
  vitalLine,
} from './eventLines'
import { isPrivateRoll, isRevealedRoll, rollLineFor } from './log'
import { undoes } from './proposals'
import type { GameStore, StoredOp } from './store'
import type { SubmitResult } from './units'
import { unitName } from './units'

/**
 * The table's event stream (ADR-063 §7, as amended): one line per thing a member did in a
 * Game, in the order the room saw it. The Feed lists it, every other
 * member's screen toasts it, and the bound Discord channel mirrors it
 * (`../../worker/shared/tableEvents.ts`): one source, three readers.
 *
 * An event is a `change_log` row (`field` 'event'); a roll and the Mediator's
 * alert keep their own rows (`log.ts`) and are read here as events too, so
 * the stream is whole without a second copy of either.
 *
 * - **Who:** an event names its actor by Discord id, so a screen never toasts
 *   its own act. The Stop Sign names nobody (`safety.ts`).
 * - **Rapid repeats merge:** a second − / + nudge (a change of one) to the
 *   same vital of the same unit, or the same line again, inside `MERGE_MS`
 *   rewrites the line it follows ("HP 8 → 5", "×3") until the line is sealed
 *   (posted to Discord). A hit, any larger change to a vital, is a line of its
 *   own, so two hits are two lines (r2 I3). A change Undo wrote
 *   (`eventLines.ts`) is a line of its own too, marked "· Undo" (r3 B2).
 * - **A mech's line names its pilot:** "Reaper (GHOST) · Heat 2 → 3", whoever
 *   is aboard, else whoever it is assigned to (r3 B2).
 * - **Private:** a row marked `private` (the Mediator's private roll) is
 *   served to Mediators only and is never mirrored (`isMirrored`), until a
 *   Mediator reveals it.
 * - **Veiled:** an Opposition roll is served to a player as its veiled line,
 *   without the NPC's or the weapon's name, until a Mediator reveals it
 *   (`log.ts`, ADR-051 §9b).
 * - **Revealed:** a roll a Mediator revealed is everyone's, whole, wherever
 *   the stream is read: the Feed, a toast, "Last session", and the bound
 *   channel, which gets its line once (r3 A1).
 */

export type TableEventKind =
  | 'vitals'
  | 'action'
  | 'roll'
  | 'board'
  | 'assign'
  | 'join'
  | 'leave'
  | 'role'
  | 'session'
  | 'downtime'
  | 'proposal'
  | 'alert'
  | 'stop'

/** One event as every reader gets it. */
export type TableEvent = {
  _id: string
  ts: number
  kind: TableEventKind
  /** The line: who and what, as the Feed, a toast and Discord all read it. */
  text: string
  /** Whose act it was; null for the Stop Sign, which names nobody. */
  actorId: string | null
  /** Mediators' eyes only: never toasted to a player, never mirrored. */
  private?: true
  /**
   * A Mediator's copy of an Opposition roll the players read without its names
   * (ADR-051 §9b): theirs to reveal. Never set on what a player is served.
   */
  veiled?: true
  /**
   * A roll a Mediator showed the table (`changeLog.reveal`): no longer private
   * or veiled for anyone. A player's screen toasts it as it arrives, and the
   * bound channel is sent its line (`isMirrored`).
   */
  revealed?: true
  /** A roll a Mediator made: the one roll a screen toasts (`tableNotices.model.ts`). */
  mediator?: true
  /** The group session began or ended here: what "Last session" is cut by. */
  session?: 'start' | 'end'
  /**
   * A proposal's line that changed a sheet: its player accepted it, or undid
   * that (r3 A5). "Last session" counts both as changes to vitals (r3 K6).
   */
  answer?: 'accepted' | 'undone'
  /**
   * The member the event is about. An assignment taken from them: their
   * screen says so itself (`assignmentNotices`). A `role` event: who mediates
   * now, whose screen pins it. A proposal: whose it is to answer, whose
   * screen pins it.
   */
  about?: string
}

/** How long a line stays open to a repeat. */
export const MERGE_MS = 10_000

/** The most events a room keeps; older ones are dropped as new ones land. */
const KEPT = 600

/** The most events a read returns: the stream's newest page. */
const SERVED = 200

/** What an act needs remembered from before it ran, to say what changed. */
export type EventsBefore = {
  resolving?: string | null
  proposal?: StoredOp | null
  session?: boolean
  /** Whether a Downtime was running. */
  downtime?: boolean
  stop?: boolean
  /** Whether the effect was switched on. */
  effectOn?: boolean
  /** Who held the unit an assignment moves. */
  holder?: string | null
  /** Whether the roll was already revealed: a second Reveal tells nobody again. */
  revealed?: boolean
}

/** Whether an event goes to the bound channel as a line: never a private one, nor one with its own post. */
export function isMirrored(event: TableEvent): boolean {
  if (event.private === true) return false
  // A roll posts as its card (`channelBindings.postRoll`), which a private one
  // never did and a veiled one did without its names: the reveal is its line.
  if (event.kind === 'roll') return event.revealed === true
  // An alert and the Stop Sign post as their own (`stopSign.ts`).
  return event.kind !== 'alert' && !event._id.startsWith('stop-up:')
}

export class GameEvents {
  constructor(
    private readonly store: GameStore,
    private readonly newId: () => string
  ) {}

  /** The newest events, newest first; a private one only for a Mediator. */
  list(actor: string): TableEvent[] {
    const member = this.store.member(actor)
    if (member === null) return []
    return this.store
      .rows(
        `select * from change_log where field in ('event', 'roll', 'alert')
         order by ts desc, id limit ?`,
        SERVED
      )
      .map((row) => this.read(row, member.mediator, actor))
      .filter((event) => event.private !== true || member.mediator)
  }

  /** What `after` needs from before the act ran. */
  before(name: GameActName, args: unknown): EventsBefore {
    const a = (args ?? {}) as Record<string, unknown>
    switch (name) {
      case 'seats.setResolving': {
        const row = this.store.rows(
          'select resolving from seats where pilot_id = ?',
          String(a.pilotId)
        )[0]
        const resolving =
          typeof row?.resolving === 'string'
            ? (JSON.parse(row.resolving) as { name?: string } | null)
            : null
        return { resolving: resolving?.name ?? null }
      }
      case 'seats.toggleEffect': {
        const row = this.store.rows('select * from seats where pilot_id = ?', String(a.pilotId))[0]
        return {
          effectOn: row !== undefined && seatOf(row).activeEffects.includes(String(a.ref)),
        }
      }
      case 'assign':
      case 'unassign':
        return { holder: this.store.unit(String(a.unitId))?.ownerId ?? null }
      case 'ops.accept':
      case 'ops.decline':
      case 'ops.withdraw':
        return { proposal: this.store.op(String(a.opId)) }
      case 'session.start':
      case 'session.end':
        return { session: this.store.rows('select 1 from session where id = 1').length > 0 }
      case 'downtime.begin':
      case 'downtime.end':
        return {
          downtime: this.store.rows('select 1 from downtime_run where id = 1').length > 0,
        }
      case 'changeLog.reveal': {
        const row = this.store.rows(
          'select after from change_log where id = ?',
          String(a.rollId)
        )[0]
        return {
          revealed:
            typeof row?.after === 'string' && isRevealedRoll(JSON.parse(row.after) as unknown),
        }
      }
      case 'safety.showStop':
      case 'safety.liftStop':
        return {
          stop:
            this.store.rows('select 1 from stop_sign where id = 1 and shown_at is not null')
              .length > 0,
        }
      default:
        return {}
    }
  }

  /**
   * Note what an act that succeeded did, and answer the events it wrote or
   * rewrote (a merged repeat keeps its id), oldest first.
   */
  after(
    actor: string,
    name: GameActName,
    args: unknown,
    value: unknown,
    before: EventsBefore,
    at: number
  ): TableEvent[] {
    const a = (args ?? {}) as Record<string, unknown>
    const who = this.memberName(actor)
    const unit = (id: unknown) => this.unitLabel(String(id))
    const say = (kind: TableEventKind, text: string, key = text) => [
      this.note(actor, at, { kind, text, key }),
    ]
    switch (name) {
      case 'submit':
        return this.vitals(actor, value as SubmitResult, at)
      case 'seats.board':
        return say('board', `${unit(a.pilotId)} boards ${unit(a.mechId)}`)
      case 'seats.dismount':
        return say('board', `${unit(a.pilotId)} climbs out, on foot`)
      case 'seats.eject':
        return say('board', `${unit(a.pilotId)} ejects`)
      case 'seats.setResolving': {
        const next = (a.resolving as { name?: unknown } | null)?.name
        if (typeof next !== 'string' || next === '' || next === before.resolving) return []
        return say('action', `${unit(a.pilotId)} uses ${next}`)
      }
      case 'seats.toggleEffect': {
        // On and off are two lines: a repeat of either counts on its own.
        const turn = before.effectOn === true ? 'off' : 'on'
        return say('action', `${unit(a.pilotId)} switches ${effectName(String(a.ref))} ${turn}`)
      }
      case 'assign': {
        const toId = typeof a.userId === 'string' ? a.userId : actor
        const text = `${unit(a.unitId)} is assigned to ${this.memberName(toId)}`
        return [this.note(actor, at, { kind: 'assign', text, key: text, ...lost(before, toId) })]
      }
      case 'unassign': {
        const text = `${unit(a.unitId)} is unassigned`
        return [this.note(actor, at, { kind: 'assign', text, key: text, ...lost(before, null) })]
      }
      case 'drawLink':
      case 'removeLink': {
        const link = a.link as LinkShape
        const verb = name === 'drawLink' ? 'is assigned to' : 'is unassigned from'
        return say('assign', `${unit(link.from.id)} ${verb} ${unit(link.to.id)}`)
      }
      case 'setMediator': {
        // Standing down says nothing: the line that matters is who runs the table now.
        if (a.mediator !== true) return []
        const text = `${this.memberName(String(a.userId))} now mediates this Game`
        return [this.note(actor, at, { kind: 'role', text, about: String(a.userId) })]
      }
      case 'redeem':
        return value === 'joined' ? say('join', `${who} joined the Game`) : []
      case 'session.start':
        return value === true
          ? [
              this.note(actor, at, {
                kind: 'session',
                text: `${this.runnerName(actor)} started the group session`,
                session: 'start',
              }),
            ]
          : []
      case 'session.end':
        return before.session === true
          ? [
              this.note(actor, at, {
                kind: 'session',
                text: `${this.runnerName(actor)} ended the group session`,
                session: 'end',
              }),
            ]
          : []
      // The whole table's screens change with these, so each is said (r2 E2).
      case 'downtime.begin':
        return value === true
          ? [
              this.note(actor, at, {
                kind: 'downtime',
                text: `${this.runnerName(actor)} began Downtime`,
              }),
            ]
          : []
      case 'downtime.end':
        return before.downtime === true
          ? [
              this.note(actor, at, {
                kind: 'downtime',
                text: `${this.runnerName(actor)} ended Downtime`,
              }),
            ]
          : []
      case 'ops.propose': {
        const op = this.store.op(String(value))
        if (op === null) return []
        // About whoever answers it: their screen pins it, so it toasts them nothing (r3 H2).
        const text = `Mediator proposes ${this.proposalLine(op)}`
        const about = this.store.unit(op.unitId)?.ownerId ?? null
        return [
          this.note(actor, at, {
            kind: 'proposal',
            text,
            key: text,
            ...(about === null ? {} : { about }),
          }),
        ]
      }
      case 'ops.accept':
      case 'ops.decline': {
        const op = before.proposal
        if (op == null || op.state !== 'proposed') return []
        const text = `${who} ${name === 'ops.accept' ? 'accepted' : 'declined'}: ${this.proposalLine(op)}`
        return [
          this.note(actor, at, {
            kind: 'proposal',
            text,
            key: text,
            ...(name === 'ops.accept' ? { answer: 'accepted' as const } : {}),
          }),
        ]
      }
      case 'changeLog.reveal': {
        // The roll's own line, now whole for everyone: a veiled one's toast and
        // Feed line rewrite in place, a private one's arrive (r3 A1).
        if (before.revealed === true) return []
        const row = this.store.rows('select * from change_log where id = ?', String(a.rollId))[0]
        return row === undefined ? [] : [this.read(row, false)]
      }
      case 'ops.withdraw': {
        const op = before.proposal
        return value === true && op != null
          ? say('proposal', `Mediator withdrew: ${this.proposalLine(op)}`)
          : []
      }
      case 'safety.showStop':
        // Nobody is named: who showed it stays in the room.
        return before.stop === true
          ? []
          : [this.note(null, at, { kind: 'stop', text: 'The Stop Sign is up. Play is paused.' })]
      case 'safety.liftStop':
        return before.stop === true
          ? [this.note(null, at, { kind: 'stop', text: 'The Stop Sign is lifted. Play resumes.' })]
          : []
      default:
        return []
    }
  }

  /**
   * The Organiser removed a member (ADR-067 §3): a line for the table, as
   * their joining was (r3 A4). Written while the roster still names them.
   */
  removed(actor: string, userId: string, at: number): TableEvent {
    return this.note(actor, at, {
      kind: 'leave',
      text: `${this.memberName(userId)} was removed from the Game`,
    })
  }

  /**
   * Seal every open line: the next repeat starts a new one. The room calls it
   * when it posts the lines to Discord, so a posted line is never rewritten.
   */
  seal(): void {
    for (const row of this.store.rows("select id, after from change_log where field = 'event'")) {
      const stored = JSON.parse(String(row.after)) as Stored
      if (stored.key === undefined) continue
      const { key: _, ...sealed } = stored
      this.store.rows(
        'update change_log set after = ? where id = ?',
        JSON.stringify(sealed),
        String(row.id)
      )
    }
  }

  private vitals(actor: string, result: SubmitResult, at: number): TableEvent[] {
    if (!result.ok) return []
    const out: TableEvent[] = []
    for (const id of result.fresh) {
      const op = this.store.op(id)
      if (op === null || op.state !== 'applied') continue
      const who = crewedLabel(this.store, op.unitId, this.unitLabel(op.unitId))
      const undo = op.source === UNDO_SOURCE
      for (const [field, label] of Object.entries(VITALS)) {
        const to = op.patch[field]
        if (typeof to !== 'number') continue
        // A vital never written reads its start: the line always says "from" (L10).
        const was = op.before?.[field]
        const from = typeof was === 'number' ? was : unsetVital(this.store, op.unitId, field)
        if (from === to) continue
        // An accepted proposal written back is said as that, for its Mediator (r3 A5).
        const undone = undoes(this.store, op, field)
        if (undone !== null) {
          const text = `${this.memberName(actor)} undid: ${this.proposalLine(undone)}`
          out.push(this.note(actor, at, { kind: 'proposal', text, answer: 'undone' }))
          continue
        }
        // A − / + nudge folds into the line before it; a hit (any larger
        // change) is its own line, and ends the nudged line it follows (r2 I3).
        const key = `v:${op.unitId}:${field}`
        const nudge = !undo && (from === null || Math.abs(to - from) === 1)
        const vital = { who, label, from, to, ...(undo ? { undo: true as const } : {}) }
        out.push(
          this.note(actor, at, {
            kind: 'vitals',
            text: vitalLine(vital),
            ...(nudge ? { key } : { ends: key }),
            vital,
          })
        )
      }
      out.push(...this.conditions(actor, op, who, at))
    }
    return out
  }

  /** A system or module switched to damaged, destroyed or back: a line each. */
  private conditions(actor: string, op: StoredOp, who: string, at: number): TableEvent[] {
    const out: TableEvent[] = []
    for (const [field, resolve] of Object.entries(CONDITIONS)) {
      const next = op.patch[field]
      if (next === null || typeof next !== 'object') continue
      const was = (op.before?.[field] ?? {}) as Record<string, unknown>
      for (const [ref, condition] of Object.entries(next as Record<string, unknown>)) {
        const words = CONDITION_WORDS[String(condition)]
        if (words === undefined || (was[ref] ?? 'intact') === condition) continue
        const text = `${who} · ${resolve(ref)?.name ?? ref} ${words}`
        out.push(this.note(actor, at, { kind: 'vitals', text }))
      }
    }
    return out
  }

  /** Write one line, or rewrite the open line it repeats. */
  private note(actor: string | null, at: number, next: Stored): TableEvent {
    const open = next.key === undefined ? undefined : this.open(actor, next.key, at)
    if (open !== undefined) {
      const merged = mergeLine(open.stored, next)
      this.store.rows(
        'update change_log set after = ?, ts = ? where id = ?',
        JSON.stringify(merged),
        at,
        open.id
      )
      return eventOf(open.id, at, actor, merged)
    }
    const id =
      next.kind === 'stop' && next.text.includes('is up') ? `stop-up:${this.newId()}` : this.newId()
    this.store.rows(
      'insert into change_log (id, field, after, source, actor_id, ts) values (?, ?, ?, ?, ?, ?)',
      id,
      'event',
      JSON.stringify(next),
      'table',
      actor,
      at
    )
    this.prune()
    return eventOf(id, at, actor, next)
  }

  /** The open line `key` would repeat: the actor's newest, unsealed and recent. */
  private open(
    actor: string | null,
    key: string,
    at: number
  ): { id: string; stored: Stored } | undefined {
    const rows = this.store.rows(
      `select id, after, actor_id from change_log
       where field = 'event' and ts >= ? order by ts desc, id limit 20`,
      at - MERGE_MS
    )
    for (const row of rows) {
      const stored = JSON.parse(String(row.after)) as Stored
      if (stored.ends === key) return undefined
      if (stored.key !== key || (row.actor_id ?? null) !== actor) continue
      return { id: String(row.id), stored }
    }
    return undefined
  }

  private prune(): void {
    this.store.rows(
      `delete from change_log where field = 'event' and id not in
         (select id from change_log where field = 'event' order by ts desc, id limit ?)`,
      KEPT
    )
  }

  /**
   * One row as `mediates` reads it: a veiled roll whole only for a Mediator.
   * `reader` is whose screen it is for; null for the line the table is told.
   */
  private read(
    row: Record<string, unknown>,
    mediates: boolean,
    reader: string | null = null
  ): TableEvent {
    const id = String(row.id)
    const ts = Number(row.ts)
    const actorId = row.actor_id == null ? null : String(row.actor_id)
    const after = typeof row.after === 'string' ? (JSON.parse(row.after) as unknown) : null
    if (row.field === 'event') return eventOf(id, ts, actorId, after as Stored)
    if (row.field === 'alert') {
      return { _id: id, ts, kind: 'alert', text: `Mediator · ${String(after)}`, actorId }
    }
    const line = rollLineFor(after, mediates)
    const roller = actorId === null ? null : this.store.member(actorId)
    return {
      _id: id,
      ts,
      kind: 'roll',
      text: actorId === reader ? line.description : signedBy(line.description, roller),
      actorId,
      ...(isPrivateRoll(after) ? { private: true as const } : {}),
      ...(line.veiled === true ? { veiled: true as const } : {}),
      ...(isRevealedRoll(after) ? { revealed: true as const } : {}),
      ...(roller?.mediator === true ? { mediator: true as const } : {}),
    }
  }

  private memberName(userId: string): string {
    return this.store.member(userId)?.displayName ?? 'Crewmate'
  }

  /**
   * Who ran the table's own act (the session, Downtime), as every Feed names them: the
   * Mediator by role, as their alerts and proposals do, so one screen never
   * has three words for one person (MD2-12); their own screen says "You"
   * (`feed.model.ts`). An Organiser running a table with no Mediator goes by
   * name, or by that role when their account has none: never "Crewmate".
   */
  private runnerName(userId: string): string {
    const member = this.store.member(userId)
    if (member?.mediator) return 'Mediator'
    return member?.displayName ?? (member?.organizer ? 'Organiser' : 'Crewmate')
  }

  private unitLabel(unitId: string): string {
    const unit = this.store.unit(unitId)
    if (unit === null) return 'A unit'
    return unitName(unit) ?? (unit.kind === 'pilot' ? 'A Pilot' : `A ${unit.kind}`)
  }

  private proposalLine(op: StoredOp): string {
    const [field = '', after = null] = Object.entries(op.patch)[0] ?? []
    return `${this.unitLabel(op.unitId)} ${fieldLabel(field)} → ${after === null ? '—' : String(after)}`
  }
}

/** Whose the unit was before an assignment moved it to `to`: nobody, when it stays theirs or was free. */
function lost(before: EventsBefore, to: string | null): { about?: string } {
  const holder = before.holder ?? null
  return holder === null || holder === to ? {} : { about: holder }
}
