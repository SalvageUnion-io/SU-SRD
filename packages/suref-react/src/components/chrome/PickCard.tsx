import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type PickCardProps = {
  /** Card title (cond 700 22px uppercase) */
  name: string
  /** Stat chips row under the name (compose with Chip) */
  chips?: ReactNode
  /** Body copy */
  children?: ReactNode
  /** Two-ended footer row (1.5px ink top border) */
  foot?: ReactNode
  selected?: boolean
  onSelect?: () => void
  className?: string
}

/**
 * Selection card for Class/Chassis/Crawler picks (design-spec §2.8 `.pick`).
 * Explicitly app chrome, NOT an entity card: 1.5px border, 6px radius.
 * Selected state = 3px rust ring + "Selected" chip.
 */
export function PickCard({
  name,
  chips,
  children,
  foot,
  selected = false,
  onSelect,
  className,
}: PickCardProps) {
  const interactive = !!onSelect
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role="button" + tabIndex + keyboard handler are applied whenever onSelect makes the card interactive
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-pressed is only set on the interactive branch, where role="button" supports it
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      onClick={onSelect}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect()
              }
            }
          : undefined
      }
      className={cn(
        'flex flex-col overflow-hidden rounded-panel border-chrome border-ink bg-paper transition-all duration-[120ms]',
        interactive &&
          'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_6px_22px_rgba(34,30,23,0.14)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/25',
        selected && 'shadow-[0_0_0_3px_var(--color-rust)]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
        <span className="font-cond text-[22px] font-bold uppercase leading-tight tracking-[0.02em] text-ink">
          {name}
        </span>
        {selected && (
          <span className="mt-0.5 shrink-0 rounded-badge bg-rust px-2 py-[2px] font-cond text-[11px] font-semibold uppercase leading-tight text-su-white">
            Selected
          </span>
        )}
      </div>
      {chips && <div className="flex flex-wrap gap-1.5 px-4 pt-2">{chips}</div>}
      {children && (
        <div className="px-4 py-3 font-body text-[12.5px] leading-[1.55] text-ink-2">
          {children}
        </div>
      )}
      {foot && (
        <div className="mt-auto flex items-center justify-between gap-2 border-t-chrome border-ink px-4 py-2.5">
          {foot}
        </div>
      )}
    </div>
  )
}
