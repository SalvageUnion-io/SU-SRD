/**
 * ConditionToggle — tri-state toggle for intact / damaged / destroyed.
 *
 * Controlled component. Cycles intact → damaged → destroyed → intact on
 * click or keyboard activation (Enter / Space). Keyboard-accessible via
 * role="button" with tabIndex.
 */

import type { KeyboardEvent } from 'react'

import { cn } from '../../lib/utils'

export type ItemCondition = 'intact' | 'damaged' | 'destroyed'

const CYCLE: Record<ItemCondition, ItemCondition> = {
  intact: 'damaged',
  damaged: 'destroyed',
  destroyed: 'intact',
}

const LABELS: Record<ItemCondition, string> = {
  intact: 'Intact',
  damaged: 'Damaged',
  destroyed: 'Destroyed',
}

const STYLES: Record<ItemCondition, string> = {
  intact: 'bg-green-600 text-white border-green-700',
  damaged: 'bg-yellow-500 text-black border-yellow-600',
  destroyed: 'bg-red-700 text-white border-red-800',
}

type ConditionToggleProps = {
  value: ItemCondition
  onChange: (next: ItemCondition) => void
  /** Optional class override for the outer element. */
  className?: string
  /** Optional accessible label prefix, e.g. the item name. */
  ariaLabelPrefix?: string
  /**
   * When true, renders as a static badge with no interactive affordance.
   * Used in read-only contexts like published snapshots.
   */
  readOnly?: boolean
}

export function ConditionToggle({
  value,
  onChange,
  className,
  ariaLabelPrefix,
  readOnly = false,
}: ConditionToggleProps) {
  function cycle() {
    onChange(CYCLE[value])
  }

  function handleKeyDown(e: KeyboardEvent<HTMLSpanElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      cycle()
    }
  }

  const label = ariaLabelPrefix
    ? `${ariaLabelPrefix} condition: ${LABELS[value]}`
    : `Condition: ${LABELS[value]}`

  const badgeClass = cn(
    'inline-flex select-none items-center rounded border px-2 py-0.5 text-xs font-semibold',
    STYLES[value],
    className
  )

  if (readOnly) {
    return (
      <span aria-label={label} className={badgeClass}>
        {LABELS[value]}
      </span>
    )
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={cycle}
      onKeyDown={handleKeyDown}
      className={cn(
        badgeClass,
        // min-h-11 ensures 44px touch target on mobile; sm:min-h-0 lets the
        // badge return to its natural (text-driven) height on larger viewports.
        'cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        'min-h-11 sm:min-h-0'
      )}
    >
      {LABELS[value]}
    </span>
  )
}
