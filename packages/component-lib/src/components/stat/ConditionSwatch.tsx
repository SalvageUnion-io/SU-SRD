import type { HTMLAttributes } from 'react'
import { cn } from '../../utils/cn'
import type { EntityStatus } from '../shared/entityStatus'

/** Tri-state swatch vocabulary — the shared entity condition set. */
export type ConditionSwatchState = EntityStatus

type ConditionSwatchProps = {
  state: ConditionSwatchState
  /**
   * Sizing / positioning override. Square by default (`size-3.5` = 14px) — a
   * swatch is a stamp-shaped glyph, so it stays square.
   */
  className?: string
} & Omit<HTMLAttributes<HTMLSpanElement>, 'className'>

/**
 * ConditionSwatch — the tri-state categorical glyph (ruleset §5, atom 9).
 *
 * **Fill-shape is the primary encoding** (grayscale-legible), hue secondary,
 * and there are **no gradients** (ruleset §3.5 / §7.1):
 *
 * - **Intact** — a solid square (`status-ok`).
 * - **Damaged** — a solid HALF, cut by `clip-path` (never a gradient fill).
 * - **Destroyed** — an ink/red outline + an SVG ✕.
 *
 * Purely visual. Mark it `aria-hidden` when a sibling already carries the
 * status word, or pass a `title` at the call site for a standalone glyph.
 */
export function ConditionSwatch({ state, className, ...rest }: ConditionSwatchProps) {
  const box = cn('relative inline-block size-3.5 rounded-pip border-chrome', className)

  if (state === 'intact') {
    return <span {...rest} className={cn(box, 'border-status-ok bg-status-ok')} />
  }

  if (state === 'damaged') {
    return (
      <span {...rest} className={cn(box, 'overflow-hidden border-status-warn')}>
        {/* Hard top-left half via clip-path — a cut, not a gradient. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-status-warn"
          style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
        />
      </span>
    )
  }

  return (
    <span {...rest} className={cn(box, 'border-status-bad')}>
      <svg
        aria-hidden="true"
        viewBox="0 0 10 10"
        className="absolute inset-0 size-full text-status-bad"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      >
        <path d="M2 2 L8 8 M8 2 L2 8" />
      </svg>
    </span>
  )
}
