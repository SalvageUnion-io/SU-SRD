import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type SelProps = {
  /** Whether the selection ring is on */
  selected: boolean
  /** Toggle handler — when provided the wrapper is keyboard-operable */
  onToggle?: () => void
  children: ReactNode
  className?: string
  /** Accessible name for the toggle (e.g. the wrapped card's title) */
  ariaLabel?: string
}

/**
 * Selection ring wrapper for entity cards in wizards (design-spec §2.8 Sel):
 * a non-layout-shifting 3px rust box-shadow ring around the card. The card
 * itself stays selection-agnostic.
 */
export function Sel({ selected, onToggle, children, className, ariaLabel }: SelProps) {
  const interactive = !!onToggle
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role="button" + tabIndex + keyboard handler are applied whenever onToggle makes the ring interactive
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-pressed is only set on the interactive branch, where role="button" supports it
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={interactive ? ariaLabel : undefined}
      onClick={onToggle}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onToggle()
              }
            }
          : undefined
      }
      className={cn(
        'rounded-[5px]',
        interactive &&
          'cursor-pointer focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/25',
        selected && 'shadow-[0_0_0_3px_var(--color-rust)]',
        className
      )}
    >
      {children}
    </div>
  )
}
