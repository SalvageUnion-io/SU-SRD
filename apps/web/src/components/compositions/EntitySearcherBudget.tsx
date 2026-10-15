/**
 * `EntitySearcher`'s soft budgets: the collapsed band's one-line readout and
 * the full pip track. Honest over capacity, and never blocking a pick.
 */

import type { CSSProperties } from 'react'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from '../../design/tokens'
import { capsLabel } from '../atoms/capsLabel'
import { statBlockRowStarts } from '../atoms/pipRows'
import { Stat } from '../atoms/Stat'
import type { BudgetConfig } from './entitySearcherTypes'

const BUDGET_SUMMARY_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  columnGap: space[12],
  rowGap: space[2],
  margin: space[0],
} satisfies CSSProperties

const BUDGET_LABEL_STYLE = {
  margin: space[0],
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  fontWeight: weight.bold,
  textTransform: 'uppercase',
  letterSpacing: tracking.capsWide,
  color: color.ink,
} satisfies CSSProperties
const BUDGET_VALUE_STYLE = {
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: '1rem',
  fontWeight: weight.bold,
} satisfies CSSProperties
const BUDGET_VALUE_OVER_STYLE = {
  ...BUDGET_VALUE_STYLE,
  color: color.statusBad,
} satisfies CSSProperties
const PIP_STACK_STYLE = {
  marginTop: space[6],
  display: 'flex',
  flexDirection: 'column',
  gap: space[4],
} satisfies CSSProperties
const PIP_ROW_STYLE = { display: 'flex', gap: space[4] } satisfies CSSProperties

function pipStyle(borderColor: string, backgroundColor: string): CSSProperties {
  return {
    width: '13px',
    height: '13px',
    borderRadius: radius.badge,
    border: `${borderWidth.chrome} solid ${borderColor}`,
    backgroundColor,
  }
}

/** The collapsed band's budget: one running-text `Stat` per track, red when over. */
export function BudgetSummary({ budgets }: { budgets: BudgetConfig[] }) {
  return (
    <p style={BUDGET_SUMMARY_STYLE}>
      {budgets.map((b) => (
        <span key={b.label} style={{ color: b.used > b.max ? color.statusBad : color.ink }}>
          <Stat
            orientation="horizontal"
            surface="plain"
            label={b.label}
            value={b.used}
            max={b.max}
            className={capsLabel({ size: 'badge', tracking: 'caps' })}
          />
        </span>
      ))}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Budget track — honest over-capacity pips (soft, never blocks; mirrors mech)
// ---------------------------------------------------------------------------

export function BudgetTrack({
  label,
  value,
  max,
  tone = 'default',
}: {
  label: string
  value: number
  max: number
  tone?: 'default' | 'ap'
}) {
  const total = Math.max(max, value)
  const isOver = value > max
  // AP is the pilot's resource, so its pips fill pilot inside an ink frame —
  // never rust, which only an action may wear (ruleset §3.1).
  const fill = tone === 'ap' ? color.pilot : color.ink
  return (
    <div>
      <p style={BUDGET_LABEL_STYLE}>
        {label} ·{' '}
        <span style={isOver ? BUDGET_VALUE_OVER_STYLE : BUDGET_VALUE_STYLE}>
          {value} / {max}
        </span>
      </p>
      {total > 0 && (
        <div style={PIP_STACK_STYLE} role="img" aria-label={`${label} ${value} of ${max}`}>
          {statBlockRowStarts(total).map(({ count, start }) => (
            <div key={start} style={PIP_ROW_STYLE}>
              {Array.from({ length: count }).map((_, c) => {
                const i = start + c
                const on = i < value
                const over = i >= max
                return (
                  <span
                    key={i}
                    data-pip={on ? 'on' : 'off'}
                    style={
                      on
                        ? over
                          ? pipStyle(color.statusBad, color.statusBad)
                          : pipStyle(color.ink, fill)
                        : pipStyle(color.ink, 'transparent')
                    }
                  />
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
