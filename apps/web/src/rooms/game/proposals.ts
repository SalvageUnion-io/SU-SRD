import type { EntityKind } from 'game-domain/entityKinds'
import type { SalvageOffer } from 'game-domain/games/proposals'
import {
  CARGO_PROPOSAL_FIELD,
  normalizeReason,
  PROPOSAL_REASON_MAX,
} from 'game-domain/games/proposals'
import { mechSalvageAllows } from 'salvageunion-reference/rules'
import { wreckHaulLots } from '../../lib/rules/downtimeEconomy'
import type { OpState } from '../ops'
import { RoomRefusal } from '../refusal'
import { unsetVital } from '../vitals'
import { isUndoSource } from './eventLines'
import type { GameStore, StoredOp, UnitRow } from './store'
import type { GameUnits, SubmitResult } from './units'
import { BatchRefused, PROPOSAL_SOURCE, unitName } from './units'

/**
 * A Mediator's proposals (ADR-030 §4): an op in `proposed` state on a
 * player's pilot or mech (ADR-063 §5), applied or declined only by the
 * member it is assigned to. A wreck's salvage offered to the crawler (r7 D8,
 * §4 as amended) is the one proposal on a crawler: any member of the crew
 * answers it, and may change its pick to another the roll allows
 * (`salvage_offers`).
 */

/** A proposal as `ops.pending` and `ops.sent` serve it; `_id` is its op's id. */
export type ProposalRead = {
  _id: string
  entityId: string
  entityType: EntityKind
  targetName: string | null
  field: string
  after: unknown
  reason: string | null
  ts: number
  /**
   * What the sheet holds now, on a proposal awaiting its answer (`pending`):
   * the notice's "HP 7 → 0". Read when served, never stored (ADR-030 §4).
   */
  current?: number | null
  /** Who sent it, on one awaiting its answer: a Mediator who handed the table on signs theirs still (r5 A11). */
  byName?: string | null
  /** A wreck's salvage: the parts its roll lets the answer pick from (r7 D8). */
  offer?: SalvageOffer
}

export type SentProposal = ProposalRead & {
  /**
   * The op's state; `superseded` for a declined one a newer proposal replaced,
   * `withdrawn` for one its Mediator took back, `undone` for an applied one
   * its player wrote back (`undoneBy`, r3 A5).
   */
  state: OpState | 'superseded' | 'withdrawn' | 'undone'
  mine: boolean
  actorName: string | null
}

/**
 * What `superseded_by` holds on a proposal a Mediator withdrew (r2 C7): the
 * op is `declined`, as a superseded one is, and this says by whom. No op has
 * this id, so it never names a successor.
 */
const WITHDRAWN = 'withdrawn'

/** The most proposals `sent` returns. */
const MAX_SENT = 100

/** The id of the op a crewmate's changed pick writes in place of `id`'s (r7 D8). */
const pickedId = (id: string) => `${id}:picked`

/** Refused copy for a pick a Mech Salvage band does not allow. */
const PICK_REFUSED = 'That pick is not one the roll allows'

/** Whether `picked` names parts of `offer`'s wreck that its band lets the salvager take. */
function allowed(offer: SalvageOffer, picked: readonly string[]): boolean {
  const keys = new Set(offer.parts.map((p) => p.key))
  if (picked.length === 0 || new Set(picked).size !== picked.length) return false
  if (!picked.every((key) => keys.has(key))) return false
  const chosen = offer.parts.filter((p) => picked.includes(p.key))
  return mechSalvageAllows(offer.band, {
    chassis: chosen.some((p) => p.kind === 'chassis'),
    systems: chosen.filter((p) => p.kind === 'system').length,
    modules: chosen.filter((p) => p.kind === 'module').length,
  })
}

export class GameProposals {
  constructor(
    private readonly store: GameStore,
    private readonly units: GameUnits
  ) {}

  /**
   * Propose a value for one field of a player's pilot or mech: an op in
   * `proposed` state (ADR-063 §5). Mediator only; the unit must be assigned.
   * A newer proposal against the same field supersedes the older, so the
   * player never weighs two at once. Proposing the same id twice is a no-op.
   */
  propose(
    actor: string,
    args: {
      id: string
      unitId: string
      field: string
      value: unknown
      reason?: string
      /** A wreck's salvage (r7 D8): what the answer may pick from instead. */
      offer?: SalvageOffer
      at: number
    }
  ): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      if (this.store.op(args.id) !== null) return
      const unit = this.store.requireUnit(args.unitId)
      const toCrew = unit.kind === 'crawler' && args.offer !== undefined
      if (unit.kind !== 'pilot' && unit.kind !== 'mech' && !toCrew) {
        throw new RoomRefusal('Only a Pilot or a Mech takes a proposal')
      }
      if (args.offer !== undefined) {
        if (args.field !== CARGO_PROPOSAL_FIELD)
          throw new RoomRefusal('Salvage is offered as cargo')
        if (!allowed(args.offer, args.offer.picked)) throw new RoomRefusal(PICK_REFUSED)
      }
      if (unit.ownerId === null && !toCrew) {
        throw new RoomRefusal('That entity is unassigned — assign it before proposing changes')
      }
      if (args.field === CARGO_PROPOSAL_FIELD) {
        if (unit.kind === 'pilot') throw new RoomRefusal('Only a Mech takes cargo')
        if (!Array.isArray(args.value) || args.value.length === 0) {
          throw new RoomRefusal('A cargo proposal names what it adds')
        }
      }
      let reason: string | undefined
      try {
        reason = normalizeReason(args.reason)
      } catch {
        throw new RoomRefusal(`A reason is at most ${PROPOSAL_REASON_MAX} characters`)
      }
      for (const live of this.store.opsIn('proposed')) {
        if (live.unitId !== unit.id || !Object.hasOwn(live.patch, args.field)) continue
        this.store.putOp({ ...live, state: 'declined', supersededBy: args.id })
      }
      this.store.putOp({
        id: args.id,
        unitId: unit.id,
        baseSeq: unit.headSeq,
        at: args.at,
        kind: 'transaction',
        source: PROPOSAL_SOURCE,
        patch: { [args.field]: args.value },
        author: actor,
        state: 'proposed',
        seq: null,
        before: null,
        ...(reason === undefined ? {} : { reason }),
        supersededBy: null,
      })
      if (args.offer !== undefined) this.putOffer(args.id, args.offer)
    })
  }

  /** What a salvage proposal offers (r7 D8), or null for any other. */
  offerOf(opId: string): SalvageOffer | null {
    const row = this.store.rows('select body from salvage_offers where op_id = ?', opId)[0]
    return row === undefined ? null : (JSON.parse(String(row.body)) as SalvageOffer)
  }

  private putOffer(opId: string, offer: SalvageOffer): void {
    this.store.sql.exec(
      'insert or replace into salvage_offers (op_id, body) values (?, ?)',
      opId,
      JSON.stringify(offer)
    )
  }

  /**
   * Whether `actor` answers `op` on `unit`: its holder, or for a wreck's
   * salvage offered to the crawler, any member of the crew (r7 D8).
   */
  private answers(actor: string, op: StoredOp, unit: UnitRow): boolean {
    if (unit.ownerId === actor) return true
    if (unit.kind !== 'crawler' || this.offerOf(op.id) === null) return false
    return this.store.member(actor) !== null
  }

  /**
   * Proposals waiting on this player, newest first: those on units assigned
   * to them, and a wreck's salvage offered to the crew (r7 D8), but to the
   * Mediator who offered it.
   */
  pending(actor: string): ProposalRead[] {
    if (this.store.member(actor) === null) return []
    const out: ProposalRead[] = []
    for (const op of this.store.opsIn('proposed')) {
      const unit = this.store.unit(op.unitId)
      if (unit === null || !this.answers(actor, op, unit)) continue
      if (unit.ownerId !== actor && op.author === actor) continue
      const offer = this.offerOf(op.id)
      const read = proposalRead(op, unit)
      const held = unit.body[read.field]
      out.push({
        ...read,
        current: typeof held === 'number' ? held : unsetVital(this.store, unit.id, read.field),
        byName: this.store.member(op.author)?.displayName ?? null,
        ...(offer === null ? {} : { offer }),
      })
    }
    return out.sort((a, b) => b.ts - a.ts)
  }

  /**
   * Every Mediator proposal, newest first, for any Mediator: one handed the
   * table inherits them. Never one another Mediator sent to the viewer's own
   * unit: theirs to answer, it reads under Awaiting your answer (r5 A11).
   */
  sent(actor: string): SentProposal[] {
    const member = this.store.member(actor)
    if (member === null || !member.mediator) return []
    const rows = this.store.rows(
      `select o.id from ops o left join units u on u.id = o.unit_id
       where o.source = ? and not (u.owner_id is not null and u.owner_id = ? and o.author != ?)
       order by o.at desc, o.id limit ?`,
      PROPOSAL_SOURCE,
      actor,
      actor,
      MAX_SENT
    )
    const out: SentProposal[] = []
    for (const row of rows) {
      const op = this.store.op(String(row.id))
      if (op === null) continue
      const unit = this.store.unit(op.unitId)
      out.push({
        ...proposalRead(op, unit),
        state:
          op.supersededBy === WITHDRAWN
            ? 'withdrawn'
            : op.supersededBy !== null
              ? 'superseded'
              : undoneBy(this.store, op) !== null
                ? 'undone'
                : op.state,
        mine: op.author === actor,
        actorName: this.store.member(op.author)?.displayName ?? null,
      })
    }
    return out
  }

  /**
   * Apply a proposal to your own unit: the player makes the write, against
   * the sheet as it is now, so a value they changed since does not bounce it.
   * A wreck's salvage (r7 D8) may be answered with another pick its roll
   * allows (`picked`): that pick is written as its own op, under its own id
   * (`pickedId`), and the offer reads superseded by it.
   */
  applyProposal(
    actor: string,
    proposalId: string,
    at: number,
    picked?: readonly string[]
  ): SubmitResult {
    try {
      return this.store.sql.transaction(() => {
        const proposal = this.proposal(proposalId)
        if (proposal === null) throw new RoomRefusal('That proposal no longer exists')
        if (proposal.state !== 'proposed') {
          throw new RoomRefusal('That proposal has already been answered')
        }
        const unit = this.store.requireUnit(proposal.unitId)
        if (!this.answers(actor, proposal, unit)) {
          throw new RoomRefusal('Only the owner can apply this')
        }
        // The crew's crawler is written as the Mediator who offered it (§5): still theirs to write.
        if (unit.kind === 'crawler') this.units.assertMayWrite(proposal.author, unit)
        else this.units.assertMayWrite(actor, unit)
        const offer = this.offerOf(proposal.id)
        const changed =
          offer !== null &&
          picked !== undefined &&
          [...picked].sort().join('\n') !== [...offer.picked].sort().join('\n')
        let answer: StoredOp = proposal
        if (changed && offer !== null && picked !== undefined) {
          if (!allowed(offer, picked)) throw new RoomRefusal(PICK_REFUSED)
          answer = {
            ...proposal,
            id: pickedId(proposal.id),
            author: actor,
            patch: { [CARGO_PROPOSAL_FIELD]: wreckHaulLots(offer.parts, offer.band, picked).lots },
          }
          this.store.putOp({ ...proposal, state: 'declined', supersededBy: answer.id })
          this.putOffer(answer.id, { ...offer, picked: [...picked] })
        }
        const seq = this.units.applyTo(
          unit,
          { ...answer, patch: appliedPatch(answer, unit), baseSeq: unit.headSeq, at },
          answer.author,
          answer.reason
        )
        return { ok: true, applied: [{ id: answer.id, seq }], fresh: [answer.id] } as const
      })
    } catch (error) {
      if (error instanceof BatchRefused) {
        if (error.result.reason === 'invalid') {
          throw new RoomRefusal(`That proposal does not fit this sheet: ${error.result.message}`)
        }
        return error.result
      }
      throw error
    }
  }

  /** A Mediator's proposal by id: an op from any other source is not one, whatever its state. */
  private proposal(id: string): StoredOp | null {
    const op = this.store.op(id)
    return op?.source === PROPOSAL_SOURCE ? op : null
  }

  /**
   * Take a proposal back before it is answered (r2 C7): any Mediator's, as
   * the sent list is. True when this withdrew it; an answered one is left be.
   */
  withdraw(actor: string, proposalId: string): boolean {
    return this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      const proposal = this.proposal(proposalId)
      if (proposal === null || proposal.state !== 'proposed') return false
      this.store.putOp({ ...proposal, state: 'declined', supersededBy: WITHDRAWN })
      return true
    })
  }

  /** Decline a proposal on your own unit. Kept, not deleted: the log is append-only. */
  declineProposal(actor: string, proposalId: string): void {
    this.store.sql.transaction(() => {
      const proposal = this.proposal(proposalId)
      if (proposal === null || proposal.state !== 'proposed') return
      const unit = this.store.unit(proposal.unitId)
      if (unit === null || !this.answers(actor, proposal, unit)) {
        throw new RoomRefusal('Only the owner can decline this')
      }
      this.store.putOp({ ...proposal, state: 'declined' })
    })
  }
}

/**
 * The patch accepting `proposal` writes: its own, but for a cargo proposal
 * (r5 B2), whose lots are added ahead of the hold as it is now. The op keeps
 * the lots it added (`putOp` never rewrites a patch), so every line reads them.
 */
function appliedPatch(proposal: StoredOp, unit: UnitRow): Record<string, unknown> {
  const added = proposal.patch[CARGO_PROPOSAL_FIELD]
  if (!Array.isArray(added)) return proposal.patch
  const held = unit.body[CARGO_PROPOSAL_FIELD]
  return { [CARGO_PROPOSAL_FIELD]: [...added, ...(Array.isArray(held) ? held : [])] }
}

/** What `field` held before `op` applied: its stored before, or what a vital never written reads. */
function heldBefore(store: GameStore, op: StoredOp, field: string): number | null {
  const was = op.before?.[field]
  return typeof was === 'number' ? was : unsetVital(store, op.unitId, field)
}

/**
 * The applied proposal `op` writes back, when it does (r3 A5): the change to
 * the same field of the same unit just before it was a Mediator's proposal,
 * and `op`, an Undo's write (`isUndoSource`), puts back what the sheet held
 * before that. It is how the player's Undo lands (`acceptedUndo`), read off
 * the op log, so nothing more is stored. A repair, a heal or Downtime's
 * Restore that reaches the old value is an ordinary change (r5 A2).
 */
export function undoes(store: GameStore, op: StoredOp, field: string): StoredOp | null {
  if (op.state !== 'applied' || op.seq === null || !isUndoSource(op.source)) return null
  const earlier = store
    .opsOf(op.unitId)
    .filter(
      (o) =>
        o.state === 'applied' &&
        o.seq !== null &&
        o.seq < (op.seq ?? 0) &&
        Object.hasOwn(o.patch, field)
    )
  const last = earlier[earlier.length - 1]
  if (last === undefined || last.source !== PROPOSAL_SOURCE) return null
  return heldBefore(store, last, field) === op.patch[field] ? last : null
}

/** The op that undid an applied `proposal` (`undoes`), or null while it stands. */
function undoneBy(store: GameStore, proposal: StoredOp): StoredOp | null {
  if (proposal.state !== 'applied' || proposal.seq === null) return null
  const [field] = Object.keys(proposal.patch)
  if (field === undefined) return null
  const next = store
    .opsOf(proposal.unitId)
    .find(
      (o) =>
        o.state === 'applied' &&
        o.seq !== null &&
        o.seq > (proposal.seq ?? 0) &&
        Object.hasOwn(o.patch, field)
    )
  return next !== undefined && undoes(store, next, field)?.id === proposal.id ? next : null
}

function proposalRead(op: StoredOp, unit: UnitRow | null): ProposalRead {
  // A cargo proposal keeps the lots it added, accepted or not (`appliedPatch`).
  const [field = '', after = null] = Object.entries(op.patch)[0] ?? []
  return {
    _id: op.id,
    entityId: op.unitId,
    entityType: unit?.kind ?? 'pilot',
    targetName: unit === null ? null : unitName(unit),
    field,
    after,
    reason: op.reason ?? null,
    ts: op.at,
  }
}
