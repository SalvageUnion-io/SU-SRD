/**
 * The Setbacks the Propose dock can fill in (play.md §15): the book's two
 * defaults that change a number on a seat (`game-domain/rules/setbacks`),
 * drafted with their reason. The player still decides (ADR-030 §4); the dock
 * only drafts it.
 */

import type { ProposalField, ProposalTarget } from 'game-domain/games/proposals'
import { fieldLabel } from 'game-domain/games/proposals'
import type { SetbackKind } from 'game-domain/rules/setbacks'
import { SETBACK_AMOUNT, setbackChange } from 'game-domain/rules/setbacks'
import { mediatorCopy } from '../../messages/play-mediator'

/** What a Setback fills the dock with. */
export type SetbackDraft = { field: ProposalField; to: number; reason: string }

/**
 * The draft a Setback makes for a target (`setbackChange`), with the Setback
 * as the reason. Null where the Setback changes nothing on it.
 */
export function setbackDraft(
  kind: SetbackKind,
  target: ProposalTarget | null
): SetbackDraft | null {
  const change = setbackChange(kind, target)
  if (change === null) return null
  return {
    ...change,
    reason:
      kind === 'heat'
        ? mediatorCopy('setbackReasonHeat', { amount: SETBACK_AMOUNT })
        : mediatorCopy('setbackReasonDamage', {
            amount: SETBACK_AMOUNT,
            unit: fieldLabel(change.field),
          }),
  }
}
