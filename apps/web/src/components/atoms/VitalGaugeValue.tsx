import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { FOCUS_RING } from './interaction'

/**
 * A compact `VitalGauge`'s value, "7/10": a read-out, or with `onPress` a
 * button (Play's "change by an amount": the press asks the caller for an
 * amount, which the caller writes through the gauge's `onChange`).
 */
export function VitalGaugeValue({
  style,
  name,
  onPress,
  children,
}: {
  style: CSSProperties
  /** The button's accessible name: what pressing it changes, and the value now. */
  name: string
  onPress?: (() => void) | undefined
  children: ReactNode
}) {
  if (onPress === undefined) return <span style={style}>{children}</span>
  return (
    <button
      type="button"
      className={cn('su-vital-gauge__value-button', FOCUS_RING)}
      style={style}
      aria-label={name}
      onClick={onPress}
    >
      {children}
    </button>
  )
}
