import { Badge } from 'component-lib'
import { tracking } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import type { OwnerChip } from '../../lib/ownership/ownerChip'

const STAMP = { letterSpacing: tracking.capsWide } satisfies CSSProperties

/**
 * The pressable seal's bare button. Its cursor, lift and fade change on hover or
 * when disabled, so they are `.su-owner-seal__claim`'s (styles/controls.css).
 */
const CLAIM = {
  backgroundColor: 'transparent',
  borderStyle: 'solid',
  borderWidth: 0,
  padding: 0,
  transitionDuration: '200ms',
  transitionProperty: 'transform, translate, scale, rotate',
  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
} satisfies CSSProperties

/**
 * The ownership seal: one stamp right of the row's name saying who holds
 * this character — `UNCLAIMED`, `YOU`, or a crewmate's name.
 *
 * ## One mark, three states
 *
 * Ownership is one fact, so it gets one mark — never two vocabularies for a
 * single field in two places. A seal that is always present and always in the same place
 * can be read down a list without reading anything else.
 *
 * Stamped rather than chipped for the reason documents are stamped: it is a
 * mark applied ON the record about its status, not a property of the character
 * itself.
 *
 * ## Why UNCLAIMED is the pressable one
 *
 * An unclaimed pre-gen is an *offer*, so the thing that announces it is also
 * the thing you press. The other two states are statements of fact with nothing
 * to do — pressing "MARA" should not do anything, and it does not.
 *
 * It opens a confirm rather than claiming outright: taking a character is a
 * commitment at the table, and the modal is where the surface says what happens
 * next (it becomes yours, and it lands in this browser).
 */
export function OwnerSeal({
  owner,
  claimable,
  disabled,
  onClaim,
}: {
  owner: OwnerChip
  claimable: boolean
  disabled: boolean
  onClaim: () => void
}) {
  // The default stamp plate: ink ground, paper text, at the smallest rung —
  // a label right of the row's name (ruleset §7.2), subordinate to it, so it
  // reads as a mark stamped ON the record rather than as another chip.
  const stamp = (
    <Badge shape="stamp" size="mini" style={STAMP}>
      {owner.label}
    </Badge>
  )

  if (!claimable) {
    // Inert: a fact about the row, not a control.
    return stamp
  }

  return (
    <button
      type="button"
      onClick={onClaim}
      disabled={disabled}
      aria-label={`${owner.label} — pick this up`}
      className="su-owner-seal__claim"
      style={CLAIM}
    >
      {stamp}
    </button>
  )
}
