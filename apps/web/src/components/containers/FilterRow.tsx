import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, tracking, weight } from '../../design/tokens'

type FilterRowProps = {
  label: string
  children: ReactNode
}

/** The label sits on paper (the EntitySearcher's Filters panel), in ink. */
const LABEL = {
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  fontWeight: weight.bold,
  textTransform: 'uppercase',
  letterSpacing: tracking.capsSnug,
} satisfies CSSProperties

/**
 * A row of filter chips under a caps label, on paper: stacked and centred on a phone,
 * label-left (`.su-filter-row`, `styles/index.css`) from `sm`.
 */
export function FilterRow({ label, children }: FilterRowProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset+legend carries min-content sizing quirks in this chip row; role="group" + aria-label conveys the same semantics
    <div className="su-filter-row" role="group" aria-label={`Filter by ${label}`}>
      <span className="su-filter-row-label" style={LABEL}>
        {label}
      </span>
      <div className="su-filter-row-chips">{children}</div>
    </div>
  )
}
