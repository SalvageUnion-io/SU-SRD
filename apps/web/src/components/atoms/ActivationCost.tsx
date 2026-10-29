import type { CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import type { Size } from '../../styles/sizing'
import { capsLabel } from './capsLabel'

/** The box's caps: the recipe's; its face, weight and tracking are `.su-cost`'s. */
const COST = cn('su-cost', capsLabel({ weight: 'inherit', tracking: 'inherit' }))

type ActivationCostProps = {
  cost: string | number
  currency?: string | undefined | number
  /**
   * The chips' Size it sits beside: it takes their type size, so it is no
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

// Each Size's type, weight and inset are its chips' (a Mini strip's 12px caps,
// a Compact strip's 14px; `og` the link preview's plate): a modifier class
// (`.su-cost--<rung>` on the box, `.su-cost-edge--<rung>` on its edge, which
// shares the type size so its `em` point matches), so a host's stylesheet can
// resize a box per breakpoint by specificity alone.
const RUNG = {
  full: { edge: 'su-cost-edge--full', box: 'su-cost--full' },
  compact: { edge: 'su-cost-edge--compact', box: 'su-cost--compact' },
  mini: { edge: 'su-cost-edge--mini', box: 'su-cost--mini' },
  og: { edge: 'su-cost-edge--og', box: 'su-cost--og' },
} as const satisfies Record<Size | 'og', { edge: string; box: string }>

export function ActivationCost({ cost, currency = 'AP', size = 'compact' }: ActivationCostProps) {
  if (cost === undefined) return null
  const displayCost = cost === 'Variable' ? 'X' : cost

  const rung = RUNG[size]
  return (
    <span className={cn('su-cost-edge', rung.edge)}>
      <span className={cn(COST, rung.box)} style={BOX}>
        {currency === '' ? displayCost : `${displayCost} ${currency}`}
      </span>
    </span>
  )
}
