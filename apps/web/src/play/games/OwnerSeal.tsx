import { Button, Stat } from '../../components/index'
import type { OwnerChip } from '../../lib/ownership/ownerChip'
import { playGamesCopy } from '../../messages/play-games'

/**
 * The ownership seal: one stamp right of the row's name saying who holds
 * this character — `UNASSIGNED`, `YOU`, or a crewmate's name; a free one the
 * viewer may take is the **Assign to me** button instead (glossary §6, r3 L3).
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
 * ## Why a free one is a button
 *
 * An unassigned pre-gen is an *offer*, so what stands in the seal's place is
 * the act itself, a Mini `Button` in the glossary's words: a tag drawn like
 * the status chips beside it was not read as something to press (LG3-06). The
 * other states are statements of fact with nothing to do — pressing "MARA"
 * should not do anything, and it does not.
 *
 * It opens a confirm rather than assigning outright: taking a character is a
 * commitment at the table, and the modal is where the surface says what happens
 * next (you edit it, and it lands in this browser).
 */
export function OwnerSeal({
  owner,
  name,
  assignable,
  disabled,
  onAssign,
}: {
  owner: OwnerChip
  /** Whose seal: the button's accessible name says which one it takes. */
  name?: string
  assignable: boolean
  disabled: boolean
  onAssign: () => void
}) {
  // The label-only chip, at the Compact's chip rung.
  const stamp = <Stat label={owner.label} size="mini" />

  if (!assignable) {
    // Inert: a fact about the row, not a control.
    return stamp
  }

  return (
    <Button
      size="mini"
      onClick={onAssign}
      disabled={disabled}
      aria-label={name === undefined ? undefined : playGamesCopy('assignToMeNamed', { name })}
    >
      {playGamesCopy('assignToMe')}
    </Button>
  )
}
