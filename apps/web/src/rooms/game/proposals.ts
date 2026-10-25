import type { EntityKind } from 'game-domain/entityKinds'
import { normalizeReason, PROPOSAL_REASON_MAX } from 'game-domain/games/proposals'
import { RoomRefusal } from '../refusal'
import type { GameStore, StoredOp, UnitRow } from './store'
import type { GameUnits, SubmitResult } from './units'
import { BatchRefused, unitName } from './units'

/**
 * A Mediator's proposals (ADR-030 §4): an op in `proposed` state on a
 * player's pilot or mech (ADR-063 §5), applied or declined only by the
 * member it is assigned to. The rules are `convex/proposals.ts`'s.
 */

export type ProposalRead = {
  id: string
  unitId: string
  kind: EntityKind
  targetName: string | null
  field: string
  value: unknown
  reason: string | null
  at: number
}

export type SentProposal = ProposalRead & {
  state: 'applied' | 'proposed' | 'declined' | 'superseded'
  mine: boolean
  author: string
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
    args: { id: string; unitId: string; field: string; value: unknown; reason?: string; at: number }
  ): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      if (this.store.op(args.id) !== null) return
      const unit = this.store.requireUnit(args.unitId)
      if (unit.kind !== 'pilot' && unit.kind !== 'mech') {
        throw new RoomRefusal('Only a Pilot or a Mech takes a proposal')
      }
      if (unit.ownerId === null) {
        throw new RoomRefusal('That entity is unassigned — assign it before proposing changes')
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
        source: 'mediator-proposal',
        patch: { [args.field]: args.value },
        author: actor,
        state: 'proposed',
        seq: null,
        before: null,
        ...(reason === undefined ? {} : { reason }),
        supersededBy: null,
      })
    })
  }

  /** Proposals waiting on this player: only those on units assigned to them. */
  pending(actor: string): ProposalRead[] {
    if (this.store.member(actor) === null) return []
    const out: ProposalRead[] = []
    for (const op of this.store.opsIn('proposed')) {
      const unit = this.store.unit(op.unitId)
      if (unit === null || unit.ownerId !== actor) continue
      out.push(proposalRead(op, unit))
    }
    return out
  }

  /** Every Mediator proposal, newest first, for any Mediator: one handed the table inherits them. */
  sent(actor: string, limit = 20): SentProposal[] {
    const member = this.store.member(actor)
    if (member === null || !member.mediator) return []
    const rows = this.store.rows(
      "select id from ops where source = 'mediator-proposal' order by at desc, id limit ?",
      Math.min(Math.max(Math.floor(limit), 1), 100)
    )
    const out: SentProposal[] = []
    for (const row of rows) {
      const op = this.store.op(String(row.id))
      if (op === null) continue
      const unit = this.store.unit(op.unitId)
      out.push({
        ...proposalRead(op, unit),
        state: op.supersededBy !== null ? 'superseded' : op.state,
        mine: op.author === actor,
        author: op.author,
      })
    }
    return out
  }

  /**
   * Apply a proposal to your own unit: the player makes the write, against
   * the sheet as it is now, so a value they changed since does not bounce it.
   */
  applyProposal(actor: string, proposalId: string, at: number): SubmitResult {
    try {
      return this.store.sql.transaction(() => {
        const proposal = this.store.op(proposalId)
        if (proposal === null) throw new RoomRefusal('That proposal no longer exists')
        if (proposal.state !== 'proposed') {
          throw new RoomRefusal('That proposal has already been answered')
        }
        const unit = this.store.requireUnit(proposal.unitId)
        if (unit.ownerId !== actor) throw new RoomRefusal('Only the owner can apply this')
        this.units.assertMayWrite(actor, unit)
        const seq = this.units.applyTo(
          unit,
          { ...proposal, baseSeq: unit.headSeq, at },
          proposal.author,
          proposal.reason
        )
        return { ok: true, applied: [{ id: proposal.id, seq }] } as const
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

  /** Decline a proposal on your own unit. Kept, not deleted: the log is append-only. */
  declineProposal(actor: string, proposalId: string): void {
    this.store.sql.transaction(() => {
      const proposal = this.store.op(proposalId)
      if (proposal === null || proposal.state !== 'proposed') return
      const unit = this.store.unit(proposal.unitId)
      if (unit?.ownerId !== actor) throw new RoomRefusal('Only the owner can decline this')
      this.store.putOp({ ...proposal, state: 'declined' })
    })
  }
}

function proposalRead(op: StoredOp, unit: UnitRow | null): ProposalRead {
  const [field = '', value = null] = Object.entries(op.patch)[0] ?? []
  return {
    id: op.id,
    unitId: op.unitId,
    kind: unit?.kind ?? 'pilot',
    targetName: unit === null ? null : unitName(unit),
    field,
    value,
    reason: op.reason ?? null,
    at: op.at,
  }
}
