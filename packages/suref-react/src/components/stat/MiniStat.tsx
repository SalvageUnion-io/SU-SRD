import { cn } from '../../utils/cn'

/** MiniStat fill semantics — StatBlock tones plus `cw` (crawler pink). */
export type MiniStatTone = 'hp' | 'ap' | 'ep' | 'sp' | 'heat' | 'cargo' | 'cw' | 'default'

const MPIP_FILL: Record<MiniStatTone, string> = {
  hp: 'border-status-bad bg-status-bad',
  ap: 'border-rust bg-rust',
  ep: 'border-rust bg-rust',
  sp: 'border-ink bg-ink',
  heat: 'border-status-warn bg-status-warn',
  cargo: 'border-cargo bg-cargo',
  cw: 'border-crawler bg-crawler',
  default: 'border-ink bg-ink',
}

/** Pips render only up to this max — bigger tracks show number-only (§2.7). */
const MINISTAT_PIP_MAX = 12

type MiniStatProps = {
  /** Stat key, e.g. 'HP' */
  label: string
  value: number
  max?: number
  stat?: MiniStatTone
  className?: string
}

/**
 * Condensed sticky-strip stat readout (design-spec §2.7 `.ministat`): key ·
 * 7×7 pip strip · value/max. Pips render only when max ≤ 12.
 */
export function MiniStat({ label, value, max, stat = 'default', className }: MiniStatProps) {
  const clamped = Math.max(0, max !== undefined ? Math.min(value, max) : value)
  const showPips = max !== undefined && max > 0 && max <= MINISTAT_PIP_MAX
  return (
    <span
      role="group"
      aria-label={`${label} ${clamped}${max !== undefined ? ` of ${max}` : ''}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[2px] border-[1.5px] border-ink bg-paper px-2 py-[3px]',
        className
      )}
    >
      <span className="font-cond text-[10px] font-bold uppercase leading-none text-wk-muted">
        {label}
      </span>
      {showPips && (
        <span className="flex items-center gap-[3px]" aria-hidden="true">
          {Array.from({ length: max }).map((_, i) => (
            <span
              key={i}
              data-pip={i < clamped ? 'on' : 'off'}
              className={cn(
                'h-[7px] w-[7px] rounded-[1px] border-[1.25px]',
                i < clamped ? MPIP_FILL[stat] : 'border-ink bg-transparent'
              )}
            />
          ))}
        </span>
      )}
      <span className="font-body text-sm font-bold leading-none text-ink">
        {clamped}
        {max !== undefined && <small className="text-[10px] font-bold text-wk-muted">/{max}</small>}
      </span>
    </span>
  )
}
