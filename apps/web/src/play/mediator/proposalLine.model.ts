/**
 * How a sent proposal reads, wherever it is listed (the propose dock, the
 * Proposals tab, the Game page's "Proposals you sent"). A proposal stores no
 * before (ADR-030 §4, as amended), so a row names only the value it asks for.
 */

import type { ProposalField, ProposalTarget } from 'game-domain/games/proposals'
import { clampProposalValue, fieldLabel } from 'game-domain/games/proposals'
import type { SentProposal } from '../../rooms/game/proposals'

export type { SentProposal }

/** "Judge · HP → 4 · "Ejection burn"". */
export function proposalLine(p: SentProposal): string {
  const value = p.after === null || p.after === undefined ? '—' : String(p.after)
  return [
    p.targetName ?? 'A sheet',
    `${fieldLabel(p.field)} → ${value}`,
    p.reason === null ? null : `“${p.reason}”`,
    p.mine || p.actorName === null ? null : `from ${p.actorName}`,
  ]
    .filter((part) => part !== null)
    .join(' · ')
}

/** How the Propose dock reads its number: the value itself, or an amount taken from or added to what the sheet has. */
export type ProposeMode = 'set' | 'take' | 'add'

/**
 * The value a proposal asks for (`after`): the number typed, or the sheet's
 * current value less or plus it ("take 3 damage"), a whole number from 0 to
 * the field's maximum when known. Null for no number, or an amount with no
 * current value to change.
 */
export function proposalAfter(
  mode: ProposeMode,
  raw: string,
  current: number | null,
  max: number | null
): number | null {
  const typed = clampProposalValue(raw, mode === 'set' ? max : null)
  if (typed === null || mode === 'set') return typed
  if (current === null) return null
  const next = Math.max(0, mode === 'take' ? current - typed : current + typed)
  return max === null ? next : Math.min(next, max)
}

/** What a weapon's hit does, as the reference prints it: an amount of HP or SP. */
export type HitDamage = { damageType: 'HP' | 'SP'; amount: number }

/** An action's damage where it is a plain number; a variable amount is the Mediator's to work out. */
export function hitDamageOf(action: {
  damage?: { damageType: string; amount: unknown }
}): HitDamage | null {
  const damage = action.damage
  if (damage === undefined || typeof damage.amount !== 'number' || damage.amount <= 0) return null
  if (damage.damageType !== 'HP' && damage.damageType !== 'SP') return null
  return { damageType: damage.damageType, amount: damage.amount }
}

/** One seat a hit can be proposed to: what it has, and what taking the hit leaves. */
export type HitTarget = {
  target: ProposalTarget
  field: ProposalField
  before: number
  after: number
}

/**
 * Who a hit can be proposed to (r4 D2): HP damage to the Pilots, SP damage to
 * the Mechs, each with what the hit leaves it ("take 3"). A target whose
 * vital is unknown is left out: Propose a change still reaches it.
 */
export function hitTargets(damage: HitDamage, targets: readonly ProposalTarget[]): HitTarget[] {
  const kind = damage.damageType === 'HP' ? 'pilot' : 'mech'
  const field: ProposalField = damage.damageType === 'HP' ? 'currentHP' : 'currentSP'
  return targets.flatMap((target) => {
    if (target.kind !== kind) return []
    const reading = target.readings[field]
    const before = reading?.current ?? reading?.max ?? null
    const after = proposalAfter('take', String(damage.amount), before, reading?.max ?? null)
    return before === null || after === null ? [] : [{ target, field, before, after }]
  })
}
