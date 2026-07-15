import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type PanelProps = {
  children: ReactNode
  /** Faint border instead of ink */
  soft?: boolean
  className?: string
}

/**
 * App-chrome panel (design-spec §2.10 `.panel`): 1.5px border, 6px radius,
 * paper ground. `soft` swaps to the faint border.
 */
export function Panel({ children, soft = false, className }: PanelProps) {
  return (
    <div
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
  /** Trailing actions (e.g. a 'Sheet' Btn) */
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
        <div className="truncate font-body text-[15px] font-medium text-ink">{name}</div>
        {meta && <div className="truncate font-body text-xs text-wk-muted">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  )
}

type EmptyProps = {
  /** Muted message line */
  message: ReactNode
  /** Decorative glyph above the message (e.g. an entity-tone lucide icon). */
  icon?: ReactNode
  /** CTA slot (usually a primary sm Btn) */
  children?: ReactNode
  className?: string
}

/**
 * Dashed empty state (design-spec §2.10 `.empty`): 1.5px dashed faint frame,
 * centered muted message + CTA, with an optional decorative glyph on top.
 */
export function Empty({ message, icon, children, className }: EmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3.5 rounded-card border-chrome border-dashed border-wk-faint p-[26px] text-center',
        className
      )}
    >
      {icon && (
        <span aria-hidden="true" className="flex items-center justify-center">
          {icon}
        </span>
      )}
      <p className="font-body text-[13px] text-wk-muted">{message}</p>
      {children}
    </div>
  )
}
