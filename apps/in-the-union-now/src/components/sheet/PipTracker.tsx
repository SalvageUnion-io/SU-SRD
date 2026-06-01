import { cn } from '../../lib/utils'

/**
 * PipTracker — the Salvage Union `.pips`/`.pip` stat track (design itun.css
 * lines 249-255). Renders `max` square pips, the first `value` of them filled.
 *
 * ITUN-only: pip tracking is a live-play affordance of the character builder,
 * not part of the static SRD, so it lives in this app rather than suref-react.
 *
 * Pips cap at 5 per row and split evenly so no row is left with a stray 1-2
 * (6 -> 3/3, 7 -> 4/3, 9 -> 5/4, 11 -> 4/4/3 ...), matching the design's Pips().
 *
 * Display-only: editing happens via the numeric stat row alongside it.
 */
type PipTone = 'hp' | 'ap' | 'default'

type PipTrackerProps = {
  /** Total pips (the stat's max). */
  max: number
  /** How many are filled (the current value, clamped to [0, max]). */
  value: number
  /** Fill colour: hp = red, ap = rust/orange-dark, default = ink. */
  tone?: PipTone
  /** Accessible label, e.g. "HP 8 of 10". */
  ariaLabel?: string
  className?: string
}

const ON_TONE: Record<PipTone, string> = {
  hp: 'border-roll-cascade bg-roll-cascade',
  ap: 'border-su-orange-dark bg-su-orange-dark',
  default: 'border-su-black bg-su-black',
}

function splitRows(n: number): number[] {
  const rows = Math.max(1, Math.ceil(n / 5))
  const base = Math.floor(n / rows)
  const extra = n % rows
  return Array.from({ length: rows }, (_, i) => base + (i < extra ? 1 : 0))
}

export function PipTracker({
  max,
  value,
  tone = 'default',
  ariaLabel,
  className,
}: PipTrackerProps) {
  if (max <= 0) return null
  const filled = Math.max(0, Math.min(value, max))
  const rows = splitRows(max)
  let idx = 0

  return (
    <div
      className={cn('flex flex-col items-center gap-1', className)}
      role="img"
      aria-label={ariaLabel ?? `${filled} of ${max}`}
    >
      {rows.map((count, r) => (
        <div key={r} className="flex justify-center gap-1">
          {Array.from({ length: count }).map(() => {
            const on = idx < filled
            idx += 1
            return (
              <span
                key={idx}
                data-pip={on ? 'on' : 'off'}
                className={cn(
                  'h-3.5 w-3.5 rounded-[2px] border-[1.5px]',
                  on ? ON_TONE[tone] : 'border-su-black bg-transparent'
                )}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
