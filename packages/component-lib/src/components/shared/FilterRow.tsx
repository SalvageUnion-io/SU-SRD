import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, tracking, weight } from '../../design/tokens'

type FilterRowProps = {
  label: string
  children: ReactNode
  /** Label sits on a dark tone band (e.g. the EntitySearcher's floating modal
   * sub-header) — switch it to paper so it stays legible instead of the
   * light-bg muted ink. */
  onDark?: boolean
}

const LABEL = {
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  fontWeight: weight.bold,
  textTransform: 'uppercase',
  letterSpacing: tracking.capsSnug,
} satisfies CSSProperties

/**
 * A row of filter chips under a caps label: stacked and centred on a phone,
 * label-left (`.su-filter-row`, `styles/index.css`) from `sm`.
 */
export function FilterRow({ label, children, onDark = false }: FilterRowProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset+legend carries min-content sizing quirks in this chip row; role="group" + aria-label conveys the same semantics
    <div className="su-filter-row" role="group" aria-label={`Filter by ${label}`}>
      <span
        className="su-filter-row-label"
        style={{ ...LABEL, color: onDark ? color.paper85 : color.wkMuted }}
      >
        {label}
      </span>
      <div className="su-filter-row-chips">{children}</div>
    </div>
  )
}
