import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay, Sel } from 'suref-react'
import { cn } from '../../lib/utils'

type SelCardProps = {
  /** The reference entity to render as a compact card. */
  entity: unknown
  /** Card title used for the Sel wrapper's accessible name. */
  name: string
  selected: boolean
  onToggle: () => void
  /** Blocks interaction (budget reached) and greys the card. */
  disabled?: boolean
  /** Inline reason shown under a disabled card. */
  disabledReason?: string
  /** Optional pseudo-header label on the card frame (e.g. tree name). */
  label?: string
  /**
   * Add-and-stack mode: when provided, the card becomes an "Add" affordance —
   * each tap appends another copy rather than toggling membership — and this
   * number is the count of copies already installed. The card is always
   * addable (so the same System/Module can stack), and the count surfaces as a
   * small "× N" badge instead of a binary selection ring. `selected` is ignored
   * in this mode.
   */
  count?: number
}

/**
 * Wizard multi-select cell (design §3.2 Sel-grid variant): a compact entity
 * card inside a Sel selection-ring wrapper. The card stays selection-agnostic;
 * the 3px rust ring is non-layout-shifting. Disabled cells keep the existing
 * pointer-events-none + inline "Budget reached" affordance.
 *
 * With `count` set the card switches to the add-and-stack model: each tap
 * appends a copy (no toggle-off), and the installed count is shown as a "× N"
 * badge — so duplicates of the same System/Module can be stacked into a
 * loadout. (Rules-legal: the only limit is slot capacity, which ITUN tracks as
 * a soft warning — Core Book p.96, "Mech Stats Explained: System Slots".)
 */
export function SelCard({
  entity,
  name,
  selected,
  onToggle,
  disabled = false,
  disabledReason,
  label,
  count,
}: SelCardProps) {
  const isStack = count !== undefined
  const installed = count ?? 0
  // In stack mode the card never shows a selection ring; it is always addable,
  // so the affordance reads "tap to add" with a running count.
  const ringOn = isStack ? false : selected
  const ariaLabel = isStack
    ? installed > 0
      ? `Add ${name} (${installed} installed)`
      : `Add ${name}`
    : name

  return (
    <div className={cn('relative', disabled && 'pointer-events-none opacity-50')}>
      <Sel selected={ringOn} onToggle={disabled ? undefined : onToggle} ariaLabel={ariaLabel}>
        <ReferenceEntityDisplay
          data={entity as SURefEntity}
          compact
          disabled={disabled}
          hide={{ actions: true, choices: true }}
          label={label}
        />
      </Sel>
      {isStack && installed > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 inline-flex h-6 min-w-6 items-center justify-center rounded-full border-[1.5px] border-rust bg-rust px-1.5 font-cond text-xs font-bold text-paper"
        >
          × {installed}
        </span>
      )}
      {disabled && disabledReason && (
        <p className="px-3 pb-2 pt-1 text-xs text-rust">{disabledReason}</p>
      )}
    </div>
  )
}
