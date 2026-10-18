import type { CSSProperties } from 'react'
import { fontSize, space, weight } from '../../design/tokens'

type ActivationCostProps = {
  cost: string | number
  currency?: string | undefined | number
  compact?: boolean
  /** Beside `mini` chips (a Token): their type size, so it is no taller than they are. */
  mini?: boolean
}

/** The point's depth: the right edge runs to a tip at mid-height. */
const TIP = '0.5em'

// The book's pointy cost box ("2AP"): one shape, cut by `clip-path`, so the
// tip always spans the box. It stretches to its row's height (`.su-cost`'s
// `align-self`, a class because a Card head centres it instead) and carries the
// bordered chips' block padding plus their 1px rule's worth, so beside them it
// is as tall as they are, never shorter. Its colours and block padding are
// `.su-cost`'s. It always sits in `.su-cost-edge`, which draws no box on paper;
// on an ink ground (the frame's `data-ground`, chrome K1) the edge is a paper
// box of the same cut 1px larger all round, and the box gives that 1px back
// off its block padding, so the edged box is exactly as tall as a bare one.
const BOX = {
  alignItems: 'center',
  clipPath: `polygon(0 0, calc(100% - ${TIP}) 0, 100% 50%, calc(100% - ${TIP}) 100%, 0 100%)`,
  display: 'inline-flex',
  flex: 'none',
  lineHeight: 1,
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

export function ActivationCost({
  cost,
  currency = 'AP',
  compact = false,
  mini = false,
}: ActivationCostProps) {
  if (cost === undefined) return null
  const displayCost = cost === 'Variable' ? 'X' : cost

  const rung = mini ? BOX_MINI : compact ? BOX_COMPACT : BOX_FULL
  // The edge shares the box's type size, so its `em` point matches the box's.
  return (
    <span className="su-cost-edge" style={{ fontSize: rung.fontSize }}>
      <span className="su-cost" style={{ ...BOX, ...rung }}>
        {currency === '' ? displayCost : `${displayCost} ${currency}`}
      </span>
    </span>
  )
}
