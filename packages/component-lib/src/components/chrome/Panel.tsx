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
  className?: string
}

/**
 * Saved-build row (design-spec §2.10 `.row`): 1.5px ink frame, name + muted
 * meta caption + trailing actions.
 */
export function Row({ name, meta, actions, className }: RowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-card border-chrome border-ink bg-paper px-3 py-2.5',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-body text-lede font-medium text-ink">{name}</div>
        {meta && <div className="truncate font-body text-xs text-wk-muted">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  )
}
