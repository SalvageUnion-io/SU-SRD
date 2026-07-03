import type { ReactNode } from 'react'

/**
 * Masonry flow for wizard selection lists: CSS columns pack variable-height
 * cards top-to-bottom, eliminating the row-height whitespace a row-major grid
 * leaves under short cards. Tradeoffs accepted for wizard lists specifically
 * (reversing #329's grid conversion here, by design): reading order is
 * column-major, and cards can reflow across columns when a filter changes the
 * list. Column count mirrors the old grid (1, sm:2); the child margin mirrors
 * its gap-4.
 */
export function SelMasonry({ children }: { children: ReactNode }) {
  return (
    <div className="columns-1 gap-4 sm:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
      {children}
    </div>
  )
}
