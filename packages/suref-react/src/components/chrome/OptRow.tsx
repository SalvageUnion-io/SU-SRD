import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type OptRowProps = {
  name: string
  /** Two-line-clamped description under the name */
  desc?: string
  active?: boolean
  onClick?: () => void
  /** 44×44 leading slot (defaults to the striped art placeholder) */
  img?: ReactNode
  className?: string
}

/**
 * Wizard master-detail list row (design-spec §2.8 OptRow): 44px art slot,
 * uppercase cond name, clamped description. Active = white bg + inset 3px
 * rust bar + trailing rust caret.
 */
export function OptRow({ name, desc, active = false, onClick, img, className }: OptRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active || undefined}
      className={cn(
        'mb-2 flex w-full cursor-pointer items-center gap-3 rounded-[3px] border-chrome border-ink px-3 py-[11px] text-left transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/25',
        active ? 'bg-paper shadow-[inset_3px_0_0_var(--color-rust)]' : 'bg-transparent',
        className
      )}
    >
      {img ?? (
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center border-chrome border-wk-faint bg-[repeating-linear-gradient(135deg,#dbe3e9_0_7px,#e7eef3_7px_14px)] text-[10px] uppercase text-[#8a97a0]"
        >
          art
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-cond text-lg font-bold uppercase leading-tight text-ink">
          {name}
        </span>
        {desc && (
          <span className="mt-0.5 line-clamp-2 block font-body text-xs leading-snug text-wk-muted">
            {desc}
          </span>
        )}
      </span>
      {/* Always reserve the caret slot so selecting a row doesn't reflow the
          flex-1 name column (caret only paints when active). */}
      <span
        aria-hidden="true"
        className="w-[1ch] shrink-0 text-center font-cond text-lg font-bold text-rust"
      >
        {active ? '▸' : ''}
      </span>
    </button>
  )
}
