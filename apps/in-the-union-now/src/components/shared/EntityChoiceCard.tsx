import { useMemo, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay, addControl } from 'suref-react'
import { cn } from '../../lib/utils'

type EntityChoiceCardProps = {
  /**
   * The reference entity to render (chassis, class, ability, equipment,
   * system, module, etc.). Accepts `unknown` because callers often work with
   * narrowed convenience subsets of the full `SURefEntity` shape; the cast
   * inside is safe because `ReferenceEntityDisplay` only reads fields it
   * recognises and ignores the rest.
   */
  entity: unknown
  selected: boolean
  /** When true, suppresses the click handler and renders a greyed appearance. */
  disabled?: boolean
  /** Optional inline reason displayed beneath the card when disabled (e.g. "Over capacity"). */
  disabledReason?: string
  /**
   * Optional soft-warning state — the card stays clickable (selection is
   * intentionally permitted) but renders a rust ring and an inline reason.
   * Use for soft rule violations like slot-cap-exceeded where the user is
   * allowed to select anyway and resolve via the capacity indicator.
   */
  warning?: boolean
  warningReason?: string
  /**
   * Slot rendered after the entity's extra content (e.g. abilities listing
   * for a class card). Passed through to `ReferenceEntityDisplay`'s
   * `afterExtraContent` slot so contributors render INSIDE the card body
   * rather than below it — mirrors the SRD ReferenceEntityIsland pattern.
   */
  afterExtraContent?: ReactNode
  onSelect: () => void
}

/**
 * Selectable wrapper for ReferenceEntityDisplay used in wizards and builder
 * grids. Renders an SRD-styled compact entity card whose entire area toggles
 * selection. Selected state is signalled by a green ring; disabled state by
 * a rust ring plus the disabled prop on the entity display.
 *
 * The control configuration uses `addControl(onSelect)` unchanged — i.e.
 * `hidden: true, cardClick: true`. The whole card is the click target with
 * a cursor-pointer + hover-lift affordance; there is no separate visible
 * action button competing for the user's click.
 */
export function EntityChoiceCard({
  entity,
  selected,
  disabled = false,
  disabledReason,
  warning = false,
  warningReason,
  afterExtraContent,
  onSelect,
}: EntityChoiceCardProps) {
  const controls = useMemo(() => {
    if (disabled) return undefined
    const base = addControl(onSelect)
    if (selected) {
      // Surface a visible Selected badge when the card is the chosen one.
      return [
        {
          ...base,
          key: 'deselect',
          icon: Check,
          ariaLabel: 'Selected — click to deselect',
          bgColor: 'var(--color-su-green)',
          hidden: false,
          cardClick: true,
        },
      ]
    }
    return [base]
  }, [disabled, selected, onSelect])

  const showRustRing = disabled || warning
  const inlineReason = disabled ? disabledReason : warning ? warningReason : undefined

  return (
    <div
      className={cn(
        'rounded-md transition-shadow',
        selected && 'shadow-[0_0_0_2px_var(--color-su-green)]',
        disabled && 'pointer-events-none opacity-50',
        showRustRing && !selected && 'shadow-[0_0_0_2px_var(--color-su-rust)]'
      )}
    >
      <ReferenceEntityDisplay
        data={entity as SURefEntity}
        compact
        disabled={disabled}
        controls={controls}
        hide={{ actions: true, choices: true }}
        afterExtraContent={afterExtraContent}
      />
      {inlineReason && (
        <p className="px-3 pb-2 pt-1 text-xs text-[var(--color-su-rust)]">{inlineReason}</p>
      )}
    </div>
  )
}
