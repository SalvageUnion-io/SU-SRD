/**
 * The Setbacks the Propose dock can fill in (play.md §15): the book's two
 * defaults that change a number on a seat.
 *
 * - **2 damage** — "When dealing damage as a Setback, the default baseline is
 *   2 SP for Mechs and 2 HP for Pilots" (Workshop Manual p.253), and a Tough
 *   Choice's default in combat (p.254).
 * - **2 Heat** — a Tough Choice out of combat: "their action succeeds, but
 *   they gain 2 Heat" (p.254). Only a mech has Heat.
 *
 * Pure: the target's readings in, the dock's Field, To and Reason out. The
 * player still decides (ADR-030 §4); the dock only drafts it.
 */

import type { ProposalField, ProposalTarget } from 'game-domain/games/proposals'
import { fieldLabel } from 'game-domain/games/proposals'
import { mediatorCopy } from '../../messages/play-mediator'

export type SetbackKind = 'damage' | 'heat'

/** What a Setback fills the dock with. */
export type SetbackDraft = { field: ProposalField; to: number; reason: string }

/** The book's default amount for both (pp.253-254). */
export const SETBACK_AMOUNT = 2

/** The field a Setback changes on this target, or null when it has none. */
function fieldFor(kind: SetbackKind, target: ProposalTarget): ProposalField | null {
  if (kind === 'heat') return target.kind === 'mech' ? 'currentHeat' : null
  return target.kind === 'mech' ? 'currentSP' : 'currentHP'
}

/**
 * The draft a Setback makes for a target: its field moved by 2, clamped to 0
 * and the field's maximum, with the Setback as the reason. Null with no
 * target, a target without the field (a pilot has no Heat) or nothing to
 * read it from.
 */
export function setbackDraft(
  kind: SetbackKind,
  target: ProposalTarget | null
): SetbackDraft | null {
  if (target === null) return null
  const field = fieldFor(kind, target)
  if (field === null) return null
  const reading = target.readings[field]
  // An unset vital is an undamaged one (`crew.vitals`): full HP or SP, no Heat.
  const current = reading?.current ?? (kind === 'heat' ? 0 : reading?.max)
  if (current == null) return null
  const max = reading?.max ?? Number.POSITIVE_INFINITY
  if (kind === 'heat') {
    return {
      field,
      to: Math.min(max, current + SETBACK_AMOUNT),
      reason: mediatorCopy('setbackReasonHeat', { amount: SETBACK_AMOUNT }),
    }
  }
  const unit = fieldLabel(field)
  return {
    field,
    to: Math.max(0, current - SETBACK_AMOUNT),
    reason: mediatorCopy('setbackReasonDamage', { amount: SETBACK_AMOUNT, unit }),
  }
}
