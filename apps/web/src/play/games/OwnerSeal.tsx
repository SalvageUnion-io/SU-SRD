import type { CSSProperties } from 'react'
import { ChipButton, Stat, tokens } from '../../components/index'
import type { OwnerChip } from '../../lib/ownership/ownerChip'
import { playGamesCopy } from '../../messages/play-games'

/**
 * The pressable seal is a `ChipButton`: a 24px target (WCAG 2.5.8) around the
 * chip drawn at its siblings' height. Its
 * cursor, lift and fade change on hover or when disabled, so they are
 * `.su-owner-seal__assign`'s (styles/controls.css).
 */
const ASSIGN = {
  transitionDuration: tokens.duration.base,
  transitionProperty: 'transform, translate, scale, rotate',
  transitionTimingFunction: tokens.ease,
} satisfies CSSProperties

/**
 * The ownership seal: one stamp right of the row's name saying who holds
 * this character — `UNASSIGNED`, `YOU`, or a crewmate's name.
 *
 * ## One mark, three states
 *
 * Ownership is one fact, so it gets one mark — never two vocabularies for a
 * single field in two places. A seal that is always present and always in the same place
 * can be read down a list without reading anything else.
 *
 * It is a chip, the label-only style of the `Stat` cell a Compact's chips are:
 * the first of the Compact's chips, wrapping and centring with them, under the
 * same rules.
 *
 * ## Why UNASSIGNED is the pressable one
 *
 * An unassigned pre-gen is an *offer*, so the thing that announces it is also
 * the thing you press. The other two states are statements of fact with nothing
 * to do — pressing "MARA" should not do anything, and it does not.
 *
 * It opens a confirm rather than assigning outright: taking a character is a
 * commitment at the table, and the modal is where the surface says what happens
 * next (you edit it, and it lands in this browser).
 */
export function OwnerSeal({
  owner,
  assignable,
  disabled,
  onAssign,
}: {
  owner: OwnerChip
  assignable: boolean
  disabled: boolean
  onAssign: () => void
}) {
  // The label-only chip, at the Compact's chip rung.
  const stamp = <Stat label={owner.label} size="compact" />

  if (!assignable) {
    // Inert: a fact about the row, not a control.
    return stamp
  }

  return (
    <ChipButton
      onClick={onAssign}
      disabled={disabled}
      aria-label={playGamesCopy('assignThisToYou', { label: owner.label })}
      className="su-owner-seal__assign"
      style={ASSIGN}
    >
      {stamp}
    </ChipButton>
  )
}
