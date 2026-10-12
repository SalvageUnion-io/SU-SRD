import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

/**
 * The full-bleed page shell: the `<main>` landmark every top-level app screen
 * sits in, with the standard ground and responsive gutters.
 *
 * Two variants, differing only in whether they stack their children with a
 * gap.
 *
 * It renders the landmark itself, so a screen using it must not nest another
 * `<main>`: a duplicate landmark is an accessibility violation, not a style
 * problem.
 */
export type PageShellProps = {
  children: ReactNode
  /**
   * Stack children in a column with the standard gap. Screens that lay out
   * their own body (the Roster's grid, the encounter tray) pass `false` and
   * keep the padding and ground without the column.
   */
  stack?: boolean
  className?: string
}

export function PageShell({ children, stack = true, className }: PageShellProps) {
  return (
    <main
      className={cn(
        // The gutters are `.su-page-shell`'s: a full-bleed `ChapterBand` reads
        // them to reach the shell's edges.
        'su-page-shell min-h-screen bg-wk-bg',
        stack && 'flex flex-col gap-6',
        className
      )}
    >
      {children}
    </main>
  )
}
