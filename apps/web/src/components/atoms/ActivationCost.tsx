import type { CSSProperties } from 'react'
import { fontSize, space, weight } from '../../design/tokens'
import { cn } from '../../lib/cn'
import type { Size } from '../../styles/sizing'
import { capsLabel } from './capsLabel'

/** The box's caps: the recipe's; its face, weight and tracking are `.su-cost`'s. */
const COST = cn('su-cost', capsLabel({ weight: 'inherit', tracking: 'inherit' }))

type ActivationCostProps = {
  cost: string | number
  currency?: string | undefined | number
  /**
   * The chips' Size it sits beside: `mini` takes their type size, so it is no
   * taller than they are. `og`: the fixed 1200 × 630 link preview's scale
   * (`OgCard`), beside its chips drawn at their 36px plate, nothing under the
   * 34px source floor (ruleset §4.6).
   */
  size?: Size | 'og'
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

/** The link preview's box: its chips' plate height, its weight their caps'. */
const BOX_OG = {
  fontSize: '44px',
  fontWeight: weight.extrabold,
  paddingBlock: space[8],
  paddingInlineStart: space[12],
  paddingInlineEnd: `calc(${space[24]} + ${TIP})`,
} satisfies CSSProperties

const BOX_FOR = {
  full: BOX_FULL,
  compact: BOX_COMPACT,
  mini: BOX_MINI,
  og: BOX_OG,
} satisfies Record<Size | 'og', CSSProperties>

export function ActivationCost({ cost, currency = 'AP', size = 'full' }: ActivationCostProps) {
  if (cost === undefined) return null
  const displayCost = cost === 'Variable' ? 'X' : cost

  const rung = BOX_FOR[size]
  // The edge shares the box's type size, so its `em` point matches the box's.
  return (
    <span className="su-cost-edge" style={{ fontSize: rung.fontSize }}>
      <span className={COST} style={{ ...BOX, ...rung }}>
        {currency === '' ? displayCost : `${displayCost} ${currency}`}
      </span>
    </span>
  )
}
