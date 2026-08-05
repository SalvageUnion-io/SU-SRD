import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type PanelProps = {
  children: ReactNode
  /** Faint border instead of ink */
  soft?: boolean
  className?: string
  /** Test hook forwarded to the root (e.g. a named callout the tests query). */
  'data-testid'?: string
}

/**
 * App-chrome panel (design-spec §2.10 `.panel`): 1.5px border, 6px radius,
 * paper ground. `soft` swaps to the faint border.
 */
export function Panel({ children, soft = false, className, 'data-testid': testId }: PanelProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'rounded-panel border-chrome bg-paper',
        soft ? 'border-wk-faint' : 'border-ink',
        className
      )}
    >
      {children}
    </div>
  )
}

type RowProps = {
  /** Primary text (Barlow 500 15px) */
  name: ReactNode
  /** Muted caption — encodes cross-links ('"Wrench" · Engineer · ↳ Iron Fist') */
  meta?: ReactNode
  /** Trailing actions (e.g. a 'Sheet' Button) */
  actions?: ReactNode
  /**
   * Let the name and meta WRAP instead of truncating to one line.
   *
   * The default single-line clamp is right for a saved-build row, whose meta is
   * a short caption. It is wrong for a row whose meta is a provenance line —
   * an invite code reads `for Sam · Mediator seat · needs approval · 2 uses
   * left · 14 days left`, and every fact after the second one is exactly what
   * the reader opened the panel for. Truncating those is losing the content to
   * keep the geometry.
   */
  wrap?: boolean
  className?: string
}

/**
 * Saved-build row (design-spec §2.10 `.row`): 1.5px ink frame, name + muted
 * meta caption + trailing actions.
 */
export function Row({ name, meta, actions, wrap = false, className }: RowProps) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-card border-chrome border-ink bg-paper px-3 py-2.5',
        // A wrapping row aligns its columns at the TOP: with two lines of meta,
        // centring pushes the trailing actions to the middle of the block.
        wrap ? 'flex-wrap items-start' : 'items-center',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className={cn('font-body text-lede font-medium text-ink', !wrap && 'truncate')}>
          {name}
        </div>
        {meta && (
          <div className={cn('font-body text-xs text-wk-muted', !wrap && 'truncate')}>{meta}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  )
}
