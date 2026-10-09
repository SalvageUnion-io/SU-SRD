import type { HTMLAttributes, ReactNode } from 'react'
import { RadioCard } from '../../chrome/RadioCardGroup'

/** The card's outer wrapper, as `resolveCardInteraction` decides it. */
export type CardOuterProps = {
  className: string
  /** A plain or button card's attributes; a radio card's name only. */
  interaction: HTMLAttributes<HTMLDivElement>
  /** Set when the card is an option in an exactly-one picker. */
  radio?: { selected: boolean; onSelect: () => void }
}

/**
 * The OUTER element every return of the card shares: a `RadioCard` when the
 * card is a radio option, else a div carrying the interaction attributes (none
 * for a read-only card).
 */
export function CardOuter({
  className,
  interaction,
  radio,
  children,
}: CardOuterProps & { children: ReactNode }) {
  if (radio) {
    return (
      <RadioCard
        selected={radio.selected}
        onSelect={radio.onSelect}
        className={className}
        aria-label={interaction['aria-label']}
      >
        {children}
      </RadioCard>
    )
  }
  return (
    <div className={className} {...interaction}>
      {children}
    </div>
  )
}
