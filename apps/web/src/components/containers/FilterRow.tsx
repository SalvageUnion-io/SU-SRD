import type { ReactNode } from 'react'
import { Eyebrow } from '../atoms/Eyebrow'

type FilterRowProps = {
  label: string
  children: ReactNode
}

/**
 * A row of filter chips under a caps label, on paper: stacked and centred on a phone,
 * label-left (`.su-filter-row`, `styles/index.css`) from `sm`.
 */
export function FilterRow({ label, children }: FilterRowProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset+legend carries min-content sizing quirks in this chip row; role="group" + aria-label conveys the same semantics
    <div className="su-filter-row" role="group" aria-label={`Filter by ${label}`}>
      {/* The label sits on paper (the EntitySearcher's Filters panel), in ink. */}
      <Eyebrow tone="ink" className="su-filter-row-label">
        {label}
      </Eyebrow>
      <div className="su-filter-row-chips">{children}</div>
    </div>
  )
}
