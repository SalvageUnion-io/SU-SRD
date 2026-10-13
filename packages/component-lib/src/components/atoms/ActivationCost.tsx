import type { CSSProperties } from 'react'
import { fontSize, space, weight } from '../../design/tokens'
import { cn } from '../../utils/cn'

type ActivationCostProps = {
  cost: string | number
  currency?: string | undefined | number
  compact?: boolean
  /** On an ink band the box is paper with ink text, so it does not sink into the ink. */
  onInk?: boolean
}

/** The point's depth: the right edge runs to a tip at mid-height. */
const TIP = '0.5em'

// The book's pointy cost box ("2AP"): one shape, cut by `clip-path`, so the
// tip always spans the box. It stretches to its row's height and carries the
// bordered chips' block padding plus their 1px rule's worth, so beside them it
// is as tall as they are, never shorter. Its colours are `.su-cost`'s, so a
// phone's chip strip can flip an ink band's paper box back to ink.
const BOX = {
  alignItems: 'center',
  alignSelf: 'stretch',
  clipPath: `polygon(0 0, calc(100% - ${TIP}) 0, 100% 50%, calc(100% - ${TIP}) 100%, 0 100%)`,
  display: 'inline-flex',
  flex: 'none',
  lineHeight: 1,
  paddingBlock: `calc(${space[2]} + 1px)`,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

// Match the datavalue tags' weight (normal compact / semibold).
const BOX_COMPACT = {
  fontSize: fontSize.xs,
  fontWeight: weight.normal,
  paddingInlineStart: space[4],
  paddingInlineEnd: `calc(${space[4]} + ${TIP})`,
} satisfies CSSProperties

const BOX_FULL = {
  fontSize: fontSize.sm,
  fontWeight: weight.semibold,
  paddingInlineStart: space[6],
  paddingInlineEnd: `calc(${space[6]} + ${TIP})`,
} satisfies CSSProperties

export function ActivationCost({
  cost,
  currency = 'AP',
  compact = false,
  onInk = false,
}: ActivationCostProps) {
  if (cost === undefined) return null
  const displayCost = cost === 'Variable' ? 'X' : cost

  return (
    <span
      className={cn('su-cost', onInk && 'su-cost--on-ink')}
      style={{ ...BOX, ...(compact ? BOX_COMPACT : BOX_FULL) }}
    >
      {currency === '' ? displayCost : `${displayCost} ${currency}`}
    </span>
  )
}
