import type { CSSProperties, ReactNode } from 'react'
import { color, space } from '../../design/tokens'
import { cn } from '../../lib/cn'
import type { LayoutGap } from './layoutGap'

const GROUND = { minHeight: '100vh', backgroundColor: color.wkBg } satisfies CSSProperties

const COLUMN = { display: 'flex', flexDirection: 'column' } satisfies CSSProperties

/** A measured page's ground: no gutters, so its band runs full-bleed. */
const MEASURED_GROUND = { backgroundColor: color.wkBg, minHeight: '100%' } satisfies CSSProperties

/** A measured page's body: under the band, a 48px foot. */
const MEASURED_BODY = { paddingBlock: `${space[20]} ${space[48]}` } satisfies CSSProperties

/**
 * The full-bleed page shell: the `<main>` landmark every top-level app screen
 * sits in, on the workshop ground.
 *
 * Two layouts:
 *
 * - **Padded** (the default): the shell's responsive gutters
 *   (`.su-page-shell`), its children stacked `gap` apart unless `stack` is
 *   `false`. A leading `ChapterBand` reaches out to its edges.
 * - **Measured** (`measure`): no gutters on the shell. `band` runs
 *   full-bleed, and the children sit under it in the page body
 *   (`.su-page-body`), centred at `measure` on the band's own row padding, so
 *   the notch and the content start on one line.
 *
 * It renders the landmark itself, so a screen using it must not nest another
 * `<main>`: a duplicate landmark is an accessibility violation, not a style
 * problem.
 */
export type PageShellProps = {
  children: ReactNode
  /**
   * Stack children in a column, `gap` apart. Screens that lay out their own
   * body (the Roster's grid, the encounter tray) pass `false` and keep the
   * padding and ground without the column.
   */
  stack?: boolean
  /** The space between stacked children: a step of `tokens.space`. */
  gap?: LayoutGap
  /** The measured layout's body width (`'75rem'`, `PAGE_MEASURE`). */
  measure?: string
  /** The measured layout's band (and anything else full-bleed above the body). */
  band?: ReactNode
  /** The measured body's own style over its 20px head and 48px foot. */
  bodyStyle?: CSSProperties
  className?: string
}

export function PageShell({
  children,
  stack = true,
  gap = 24,
  measure,
  band,
  bodyStyle,
  className,
}: PageShellProps) {
  const column = stack ? { ...COLUMN, gap: space[gap] } : undefined
  if (measure !== undefined) {
    return (
      <main className={className} style={MEASURED_GROUND}>
        {band}
        <div
          className="su-page-body"
          style={{ ...MEASURED_BODY, ...column, maxWidth: measure, ...bodyStyle }}
        >
          {children}
        </div>
      </main>
    )
  }
  return (
    <main
      // The gutters are `.su-page-shell`'s: a full-bleed `ChapterBand` reads
      // them to reach the shell's edges.
      className={cn('su-page-shell', className)}
      style={{ ...GROUND, ...column }}
    >
      {children}
    </main>
  )
}
