import type { CSSProperties, ReactNode } from 'react'
import { color, space } from '../../design/tokens'
import { cn } from '../../utils/cn'

const GROUND = { minHeight: '100vh', backgroundColor: color.wkBg } satisfies CSSProperties

const STACK = {
  ...GROUND,
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
} satisfies CSSProperties

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
      // The gutters are `.su-page-shell`'s: a full-bleed `ChapterBand` reads
      // them to reach the shell's edges.
      className={cn('su-page-shell', className)}
      style={stack ? STACK : GROUND}
    >
      {children}
    </main>
  )
}
