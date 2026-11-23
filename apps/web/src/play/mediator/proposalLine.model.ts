/**
 * How a sent proposal reads, wherever it is listed (the propose dock, the
 * Proposals tab, the Game page's "Proposals you sent"). A proposal stores no
 * before (ADR-030 §4, as amended), so a row names only the value it asks for.
 */

import type { ProposalField, ProposalTarget } from 'game-domain/games/proposals'
import { clampProposalValue, fieldLabel, proposalValueText } from 'game-domain/games/proposals'
import { playCopy } from '../../messages/play'
import type { SentProposal } from '../../rooms/game/proposals'

export type { SentProposal }

/**
 * The reason a proposal from a veiled Opposition roll gives (r7 C7, MD7-02):
 * the Feed's rule, the table rolled and never the NPC ("Mediator rolled ·
 * Mech Salvage"), since the player reads it as the Feed's veiled line does.
 */
export function veiledReason(table: string): string {
  return [playCopy('mediatorRolled'), table].join(' · ')
}

/** "Judge · HP → 4 · "Ejection burn"". */
export function proposalLine(p: SentProposal): string {
  const value = proposalValueText(p.after)
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
  /** The vital the hit lands in, as the sheet labels it: HP on a Pilot, SP on a Mech. */
  unit: 'HP' | 'SP'
  before: number
  after: number
}

/**
 * The damage a hit does at a target's scale (r8 B6): a Mech takes half an HP
 * weapon's damage, rounded down (Core Book p.240); a Pilot twice an SP
 * weapon's (Core Book p.241).
 */
function scaled(damage: HitDamage, unit: 'HP' | 'SP'): number {
  if (damage.damageType === unit) return damage.amount
  return unit === 'SP' ? Math.floor(damage.amount / 2) : damage.amount * 2
}

/**
 * Who a hit can be proposed to (r4 D2, r8 B6): every Pilot, mounted or not,
 * and every Mech, each at its own scale, the damage's own first, each with
 * what the hit leaves it ("take 3"). A target whose vital is unknown is left
 * out, as is a Mech an HP hit is too small to scratch: Propose a change still
 * reaches it.
 */
export function hitTargets(damage: HitDamage, targets: readonly ProposalTarget[]): HitTarget[] {
  const own = damage.damageType === 'HP' ? 'pilot' : 'mech'
  const order = [...targets].sort((a, b) => Number(b.kind === own) - Number(a.kind === own))
  return order.flatMap((target) => {
    const unit = target.kind === 'pilot' ? 'HP' : 'SP'
    const field: ProposalField = unit === 'HP' ? 'currentHP' : 'currentSP'
    const amount = scaled(damage, unit)
    if (amount <= 0) return []
    const reading = target.readings[field]
    const before = reading?.current ?? reading?.max ?? null
    const after = proposalAfter('take', String(amount), before, reading?.max ?? null)
    return before === null || after === null ? [] : [{ target, field, unit, before, after }]
  })
}
