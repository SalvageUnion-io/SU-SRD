import type { CSSProperties } from 'react'
import { fontSize, space, weight } from '../../design/tokens'

type ActivationCostProps = {
  cost: string | number
  currency?: string | undefined | number
  compact?: boolean
  /** Beside `mini` chips (a Token): their type size, so it is no taller than they are. */
  mini?: boolean
  /** On an ink band the ink box keeps a paper edge, so it does not sink into the ink. */
  onInk?: boolean
}

/** The point's depth: the right edge runs to a tip at mid-height. */
const TIP = '0.5em'

// The book's pointy cost box ("2AP"): one shape, cut by `clip-path`, so the
// tip always spans the box. It stretches to its row's height (`.su-cost`'s
// `align-self`, a class because a Card head centres it instead) and carries the
// bordered chips' block padding plus their 1px rule's worth, so beside them it
// is as tall as they are, never shorter. Its colours are `.su-cost`'s. On an
// ink band it sits in `.su-cost-edge`, a paper box of the same cut 1px larger
// all round, which takes that 1px back off the block padding so the edged box
// is exactly as tall as a bare one.
const BOX = {
  alignItems: 'center',
  clipPath: `polygon(0 0, calc(100% - ${TIP}) 0, 100% 50%, calc(100% - ${TIP}) 100%, 0 100%)`,
  display: 'inline-flex',
  flex: 'none',
  lineHeight: 1,
  paddingBlock: `calc(${space[2]} + 1px)`,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

// The chips' weight, bold at every size.
const BOX_COMPACT = {
  fontSize: fontSize.xs,
  fontWeight: weight.bold,
  paddingInlineStart: space[4],
  paddingInlineEnd: `calc(${space[4]} + ${TIP})`,
} satisfies CSSProperties

const BOX_MINI = { ...BOX_COMPACT, fontSize: fontSize.badge } satisfies CSSProperties

const BOX_FULL = {
  fontSize: fontSize.sm,
  fontWeight: weight.bold,
  paddingInlineStart: space[6],
  paddingInlineEnd: `calc(${space[6]} + ${TIP})`,
} satisfies CSSProperties

// Inside the paper edge, which supplies the 1px rule's worth itself.
const EDGED = { paddingBlock: space[2] } satisfies CSSProperties

export function ActivationCost({
  cost,
  currency = 'AP',
  compact = false,
  mini = false,
  onInk = false,
}: ActivationCostProps) {
  if (cost === undefined) return null
  const displayCost = cost === 'Variable' ? 'X' : cost

  const rung = mini ? BOX_MINI : compact ? BOX_COMPACT : BOX_FULL
  const box = (
    <span className="su-cost" style={{ ...BOX, ...rung, ...(onInk ? EDGED : {}) }}>
      {currency === '' ? displayCost : `${displayCost} ${currency}`}
    </span>
  )
  // The edge shares the box's type size, so its `em` point matches the box's.
  return onInk ? (
    <span className="su-cost-edge" style={{ fontSize: rung.fontSize }}>
      {box}
    </span>
  ) : (
    box
  )
}
