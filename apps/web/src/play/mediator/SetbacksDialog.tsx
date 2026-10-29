/**
 * SetbacksDialog — Setbacks & Tough Choices, a press away on the Propose dock
 * (play.md §15; Workshop Manual pp.252-254).
 *
 * Its head row is the two defaults that change a number (`setbacks.model.ts`):
 * **2 damage** (2 SP to a mech, 2 HP to a pilot) and **+2 Heat** (a Tough
 * Choice out of combat, a mech's only). Picking one fills the dock's Field, To
 * and Reason for the target it is aimed at and closes the dialog; the
 * Mediator still presses Propose and the player still decides. Under it, the
 * book's Setbacks and Tough Choices guides, as their reference cards, to pick
 * the rest from by eye.
 */

import type { ProposalTarget } from 'game-domain/games/proposals'
import { fieldLabel } from 'game-domain/games/proposals'
import type { SetbackKind } from 'game-domain/rules/setbacks'
import { SETBACK_AMOUNT } from 'game-domain/rules/setbacks'
import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Button, ModalShell, ReferenceEntityCard, tokens } from '../../components/index'
import { useGameData } from '../../lib/useGameData'
import { mediatorCopy } from '../../messages/play-mediator'
import { MUTED } from './mediatorStyles.model'
import type { SetbackDraft } from './setbacks.model'
import { setbackDraft } from './setbacks.model'

const { space } = tokens

/** The dialog's body is flush: the stack keeps the panel's gutter. */
const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
  padding: `${space[12]} ${space[20]} ${space[20]}`,
} satisfies CSSProperties

const PICKS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[8],
} satisfies CSSProperties

/** The guides it shows, in the book's order, by slug. */
const GUIDES = ['setbacks', 'tough-choices'] as const

const GUIDE_SCHEMAS = ['guides']

type SetbacksDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The dock's target, which a pick drafts for. */
  target: ProposalTarget | null
  onPick: (draft: SetbackDraft) => void
}

export function SetbacksDialog({ open, onOpenChange, target, onPick }: SetbacksDialogProps) {
  const { ready } = useGameData({ schemas: GUIDE_SCHEMAS })
  const pick = (kind: SetbackKind) => {
    const draft = setbackDraft(kind, target)
    if (draft === null) return
    onPick(draft)
    onOpenChange(false)
  }
  const damage = setbackDraft('damage', target)
  const heat = setbackDraft('heat', target)
  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={mediatorCopy('setbacksAndToughChoices')}
      width="default"
    >
      <div style={STACK}>
        <p style={MUTED}>
          {target === null
            ? mediatorCopy('setbacksPickATarget')
            : mediatorCopy('setbacksFillFor', { name: target.label })}
        </p>
        <div style={PICKS}>
          <Button size="mini" disabled={damage === null} onClick={() => pick('damage')}>
            {mediatorCopy('setbackDamage', {
              amount: SETBACK_AMOUNT,
              unit: damage === null ? mediatorCopy('spOrHp') : fieldLabel(damage.field),
            })}
          </Button>
          <Button size="mini" disabled={heat === null} onClick={() => pick('heat')}>
            {mediatorCopy('setbackHeat', { amount: SETBACK_AMOUNT })}
          </Button>
        </div>
        {ready
          ? GUIDES.map((slug) => {
              const guide = SalvageUnionReference.Guides.getBySlug(slug)
              return guide === undefined ? null : <ReferenceEntityCard key={slug} data={guide} />
            })
          : null}
      </div>
    </ModalShell>
  )
}
