import { useMemo } from 'react'
import { Check } from 'lucide-react'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay, addControl } from 'suref-react'

// SURefEntity is imported only for the cast below; keep the public prop loose.
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
  onSelect: () => void
}

/**
 * Selectable wrapper for ReferenceEntityDisplay used in wizards and builder
 * grids. Renders an SRD-styled compact entity card whose entire area toggles
 * selection. Selected state is signalled by a green ring; disabled state by
 * a rust ring plus the disabled prop on the entity display.
 */
export function EntityChoiceCard({
  entity,
  selected,
  disabled = false,
  disabledReason,
  warning = false,
  warningReason,
  onSelect,
}: EntityChoiceCardProps) {
  const controls = useMemo(() => {
    if (disabled) return undefined
    const base = { ...addControl(onSelect), hidden: false, cardClick: true }
    if (selected) {
      return [
        {
          ...base,
          key: 'deselect',
          icon: Check,
          ariaLabel: 'Selected — click to deselect',
          bgColor: 'var(--color-su-green)',
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
      />
      {inlineReason && (
        <p className="px-3 pb-2 pt-1 text-xs text-[var(--color-su-rust)]">{inlineReason}</p>
      )}
    </div>
  )
}
