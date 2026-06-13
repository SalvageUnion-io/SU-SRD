import { cn } from '../../utils/cn'

type WiredToggleProps = {
  wired: boolean
  onToggle?: (wired: boolean) => void
  className?: string
}

/**
 * Wired/Offline switch (design-spec §2.10 `.wired`): black chip with a green
 * haloed dot when wired; transparent with faint text/dot when offline.
 */
export function WiredToggle({ wired, onToggle, className }: WiredToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={wired}
      onClick={onToggle ? () => onToggle(!wired) : undefined}
      disabled={!onToggle}
      className={cn(
        'inline-flex items-center gap-2 rounded-[2px] px-2.5 py-1 font-cond text-[11px] font-bold uppercase tracking-[0.1em] transition-colors duration-[120ms]',
        onToggle && 'cursor-pointer',
        wired ? 'bg-ink text-su-white' : 'bg-transparent text-[#635c52]',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-2 w-2 rounded-full',
          wired
            ? 'bg-status-ok shadow-[0_0_0_2px_oklch(from_var(--color-status-ok)_l_c_h/0.35)]'
            : 'bg-[#635c52]'
        )}
      />
      {wired ? 'Wired' : 'Offline'}
    </button>
  )
}
