import { Badge, cn } from 'component-lib'
import type { OwnerChip } from '../../lib/ownership/ownerChip'

/**
 * The ownership seal: one stamp in the row's top-right corner saying who holds
 * this character — `UNCLAIMED`, `YOU`, or a crewmate's name.
 *
 * ## One mark, three states
 *
 * Ownership is one fact, so it gets one mark. The surface previously said it
 * two ways at once: an owner chip in the caption for held characters, and a
 * separate UNCLAIMED stamp among the buttons for free ones — two vocabularies
 * for a single field, in two different places, so scanning a column meant
 * checking both. A seal that is always present and always in the same corner
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
  // a plate riveted across the row's top border, subordinate to the name it
  // sits beside. It was `inverse` (paper ground, ink text) at `compact`, which
  // read as another chip floating near the corner rather than as a mark
  // stamped ON the record.
  const stamp = (
    <Badge shape="stamp" size="mini" className="tracking-caps-wide">
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
      className={cn(
        'cursor-pointer border-0 bg-transparent p-0',
        'transition-transform duration-200 hover:-translate-y-px disabled:cursor-default disabled:opacity-50'
      )}
    >
      {stamp}
    </button>
  )
}
