import type { ReactNode } from 'react'

type SelMasonryProps = {
  children: ReactNode
  /**
   * Radio-group semantics for exactly-one pickers (wizard-refresh Phase 4,
   * mockup Screen 01 `role="radiogroup"`): pair with `<SelCard radio>` cells
   * and pass an accessible group name via `ariaLabel`.
   */
  radio?: boolean
  /** Accessible name for the radiogroup (required when `radio` is set). */
  ariaLabel?: string
}

/**
 * Masonry flow for wizard selection lists: CSS columns pack variable-height
 * cards top-to-bottom, eliminating the row-height whitespace a row-major grid
 * leaves under short cards. Tradeoffs accepted for wizard lists specifically
 * (reversing #329's grid conversion here, by design): reading order is
 * column-major, and cards can reflow across columns when a filter changes the
 * list. Column count mirrors the old grid (1, sm:2); the child margin mirrors
 * its gap-4.
 */
export function SelMasonry({ children, radio = false, ariaLabel }: SelMasonryProps) {
  const className = 'columns-1 gap-4 sm:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid'
  if (radio) {
    return (
      <div role="radiogroup" aria-label={ariaLabel} className={className}>
        {children}
      </div>
    )
  }
  return <div className={className}>{children}</div>
}
