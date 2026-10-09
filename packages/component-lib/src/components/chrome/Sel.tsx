import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { activateOnKey, FOCUS_RING, SELECTION_RING, SELECTION_RING_INK_DOUBLE } from './interaction'
import { RadioCard } from './RadioCardGroup'

type SelProps = {
  /** Whether the selection ring is on */
  selected: boolean
  /** Toggle handler — when provided the wrapper is keyboard-operable */
  onToggle?: () => void
  children: ReactNode
  className?: string
  /** Accessible name for the toggle (e.g. the wrapped card's title) */
  ariaLabel?: string
  /**
   * Radio semantics for exactly-one pickers (wizard-refresh Phase 4): the
   * wrapper is a `RadioCard` (`role="radio"` + `aria-checked`) instead of the
   * default button + `aria-pressed`. Put it in a `RadioCardGroup` (or
   * MasonryColumns' `radio`) for the arrow keys.
   */
  radio?: boolean
  /**
   * Selection-ring style. `rust` (default) is the standard 3px rust ring;
   * `ink-double` is the double-ink halo used by the onboarding / custom-build
   * doors (see {@link SELECTION_RING_INK_DOUBLE}).
   */
  ring?: 'rust' | 'ink-double'
}

/**
 * Selection ring wrapper for entity cards in wizards (design-spec §2.8 Sel):
 * a non-layout-shifting 3px rust box-shadow ring around the card. The card
 * itself stays selection-agnostic.
 */
export function Sel({
  selected,
  onToggle,
  children,
  className,
  ariaLabel,
  radio = false,
  ring = 'rust',
}: SelProps) {
  const interactive = !!onToggle
  const selectionRing = ring === 'ink-double' ? SELECTION_RING_INK_DOUBLE : SELECTION_RING
  const ringClass = cn(
    'rounded-panel',
    interactive && cn('cursor-pointer', FOCUS_RING),
    selected && selectionRing,
    className
  )
  if (radio && onToggle) {
    return (
      <RadioCard
        selected={selected}
        onSelect={onToggle}
        aria-label={ariaLabel}
        className={ringClass}
      >
        {children}
      </RadioCard>
    )
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role + tabIndex + keyboard handler are applied whenever onToggle makes the ring interactive
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-pressed is only set on the interactive branch, where role="button" supports it
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={interactive ? ariaLabel : undefined}
      onClick={onToggle}
      onKeyDown={interactive ? activateOnKey(onToggle) : undefined}
      className={ringClass}
    >
      {children}
    </div>
  )
}
