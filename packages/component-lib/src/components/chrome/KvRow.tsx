import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type KvRowProps = {
  /** Fixed-rail uppercase micro-label. */
  label: ReactNode
  /** Value cell. Empty (`null` / `undefined` / `''`) renders the muted "required" placeholder. */
  value?: ReactNode
  className?: string
}

/**
 * KvRow — the review-recap definition row (design-spec §2.10): a fixed 120px
 * uppercase micro-label rail + value cell, bottom-ruled and self-clearing on the
 * last row (`last:border-0`). An empty value renders a muted "required"
 * placeholder — muted ink, not rust: rust is the ACTION colour (ruleset §3.1)
 * and this is read-only text. Distinct from `Panel`'s `Row` (name / meta /
 * actions) and `Field` (form label + control) — this is a read-only summary
 * line, the shape the pilot / mech / crawler Review steps each hand-rolled.
 */
export function KvRow({ label, value, className }: KvRowProps) {
  const empty = value === null || value === undefined || value === ''
  return (
    <div
      className={cn(
        'flex items-baseline gap-3 border-b border-wk-faint py-2 last:border-0',
        className
      )}
    >
      <span className="w-[120px] shrink-0 font-cond text-xs font-bold uppercase leading-tight tracking-caps text-wk-muted">
        {label}
      </span>
      <span className={cn('min-w-0 flex-1 font-body text-sm', empty ? 'text-ink-50' : 'text-ink')}>
        {empty ? 'required' : value}
      </span>
    </div>
  )
}
