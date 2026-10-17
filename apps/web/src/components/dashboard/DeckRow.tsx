/**
 * DeckRow — one action in the Actions deck, on the canvas (`DeckList`) and the
 * phone (`PhoneDeck`): the action's `ReferenceEntityCard` at its compact head
 * extent (the one-line listing row, ruleset §1), its cost pennant the deck's
 * action (board D1). The Dashboard stays flat: no speckle.
 *
 * A locked action (out of range, overheated) is a caller-resolved overlay on
 * the canonical card, never a property of the card: it dims, and says why
 * either as a tooltip (`lock="title"`, the canvas) or as a line under it
 * (`lock="note"`, the phone, where there is no hover). Each row carries
 * `data-deck-key`, so focus can return to the row that opened the resolve.
 */

import type { CSSProperties } from 'react'
import { color, font, fontSize, space } from '../../design/tokens'
import type { ReferenceCardEntity, ReferenceEntityControl } from '../index'
import { ReferenceEntityCard } from '../index'

/**
 * A render-ready action: the action ENTITY drives the header-only card, so the
 * deck reuses the canonical action rendering instead of a hand-rolled row.
 */
export type DeckEntry = {
  key: string
  /** Any card-renderable entity — ACTIONS are meta-entities, not `RefEntity`. */
  entity: ReferenceCardEntity
  /** Accessible name for the row (the action name). */
  name: string
  locked: boolean
  lockTitle?: string
}

const LOCK_NOTE = {
  margin: `${space[4]} 0 0`,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  color: color.ink,
} satisfies CSSProperties

type DeckRowProps = {
  row: DeckEntry
  /** The pennant: its word, what it does, and whether a lock disables it. */
  pennant: {
    label: string
    ariaLabel?: string
    onClick: () => void
    /** A locked action cannot be paid for (the phone's Activate). */
    disabledWhenLocked?: boolean
  }
  /** The row's body opens the action without paying; omitted, only the pennant acts. */
  onOpen?: () => void
  /** How a locked row says why: a tooltip, or a line under it. */
  lock: 'title' | 'note'
}

export function DeckRow({ row, pennant, onOpen, lock }: DeckRowProps) {
  const control: ReferenceEntityControl = {
    key: 'pennant',
    pennant: true,
    label: pennant.label,
    onClick: pennant.onClick,
    ...(pennant.ariaLabel ? { ariaLabel: pennant.ariaLabel } : {}),
    ...(lock === 'title' && row.lockTitle ? { title: row.lockTitle } : {}),
    ...(pennant.disabledWhenLocked ? { disabled: row.locked } : {}),
  }
  return (
    <li data-deck-key={row.key} title={lock === 'title' ? row.lockTitle : undefined}>
      <ReferenceEntityCard
        data={row.entity}
        size="compact"
        extent="head"
        texture={false}
        // Dimmed, still openable: Resolve says why it cannot run.
        disabled={row.locked}
        controls={[control]}
        {...(onOpen ? { cardClickLabel: `Open ${row.name}`, onCardClick: onOpen } : {})}
      />
      {lock === 'note' && row.locked && row.lockTitle ? (
        <p style={LOCK_NOTE}>{row.lockTitle}</p>
      ) : null}
    </li>
  )
}
