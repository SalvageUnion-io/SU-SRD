import type { CSSProperties, ReactNode } from 'react'
import { radius } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { activateOnKey, FOCUS_RING, SELECTION_RING } from '../atoms/interaction'
import { SelectedSeal } from '../entity/modes/select'
import { CardControlRail } from './CardControlRail'
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
   * Radio semantics for exactly-one pickers: the
   * wrapper is a `RadioCard` (`role="radio"` + `aria-checked`) instead of the
   * default button + `aria-pressed`. Put it in a `RadioCardGroup` (or
   * MasonryColumns' `radio`) for the arrow keys.
   */
  radio?: boolean
}

const RING = { borderRadius: radius.card, position: 'relative' } satisfies CSSProperties
const RING_INTERACTIVE = { ...RING, cursor: 'pointer' } satisfies CSSProperties

/**
 * Select mode for a level-1 pick that is no entity (a wizard's "Custom build",
 * an NPC's "Start blank"; design-spec §2.8 Sel): selected, the non-layout-
 * shifting 3px ink ring around its frame and the "Selected" seal riding the
 * frame's top-right, as a selected Card wears them (hard rule R15). The
 * content itself stays selection-agnostic.
 */
export function Sel({
  selected,
  onToggle,
  children,
  className,
  ariaLabel,
  radio = false,
}: SelProps) {
  const interactive = !!onToggle
  const ringClass = cn(interactive && FOCUS_RING, selected && SELECTION_RING, className)
  const ringStyle = interactive ? RING_INTERACTIVE : RING
  const seal = selected ? <CardControlRail seals={[<SelectedSeal key="seal" />]} /> : null
  if (radio && onToggle) {
    return (
      <RadioCard
        selected={selected}
        onSelect={onToggle}
        aria-label={ariaLabel}
        className={ringClass}
        style={ringStyle}
      >
        {seal}
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
      style={ringStyle}
    >
      {seal}
      {children}
    </div>
  )
}
