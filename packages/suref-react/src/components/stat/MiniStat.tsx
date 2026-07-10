import { cn } from '../../utils/cn'
import { heatDangerFrom, heatLevel } from './heatLevel'

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
 * 7×7 pip strip · value/max. Pips render only when max ≤ 12. The `heat` tone
 * escalates (U-1): lit pips past ~70% of cap go status-bad, the value reads
 * red while dangerous, and at cap the chip gets a red border + subtle pulse.
 */
export function MiniStat({ label, value, max, stat = 'default', className }: MiniStatProps) {
  // Over-capacity honesty (design review): the derived mech Hold (cargo tone)
  // can exceed its soft cap — show the true value + red over-pips rather than
  // clamping to a lie, matching the StatBlock hero tracker and the Hold panel.
  // Other tones stay clamped 0..max (a bounded resource never reads over).
  const isOver = stat === 'cargo' && max !== undefined && value > max
  const clamped = isOver ? value : Math.max(0, max !== undefined ? Math.min(value, max) : value)
  const total = isOver ? value : (max ?? 0)
  const showPips = max !== undefined && max > 0 && total <= MINISTAT_PIP_MAX

  // Heat escalation (U-1): heat tone only — inert without a positive max.
  const level = stat === 'heat' ? heatLevel(clamped, max) : 'normal'
  const heatDanger =
    stat === 'heat' && max !== undefined && max > 0 ? heatDangerFrom(max) : Infinity

  return (
    // biome-ignore lint/a11y/useSemanticElements: a <fieldset> cannot render as an inline stat chip; role="group" carries the same semantics
    <span
      role="group"
      aria-label={`${label} ${clamped}${max !== undefined ? ` of ${max}` : ''}${
        isOver ? ' — over capacity' : ''
      }`}
      data-heat={level !== 'normal' ? level : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[2px] border-[1.5px] bg-paper px-2 py-[3px]',
        level === 'critical' ? 'border-status-bad motion-safe:animate-heat-pulse' : 'border-ink',
        className
      )}
    >
      <span className="font-cond text-[10px] font-bold uppercase leading-none text-wk-muted">
        {label}
      </span>
      {showPips && (
        <span className="flex items-center gap-[3px]" aria-hidden="true">
          {Array.from({ length: total }).map((_, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: pips are positional — the index IS their identity
              key={i}
              data-pip={i < clamped ? 'on' : 'off'}
              className={cn(
                'h-[7px] w-[7px] rounded-[1px] border-[1.25px]',
                i < clamped
                  ? i >= (max ?? Infinity) || i >= heatDanger
                    ? 'border-status-bad bg-status-bad'
                    : MPIP_FILL[stat]
                  : 'border-ink bg-transparent'
              )}
            />
          ))}
        </span>
      )}
      <span
        className={cn(
          'font-body text-sm font-bold leading-none',
          level !== 'normal' || isOver ? 'text-status-bad' : 'text-ink'
        )}
      >
        {clamped}
        {max !== undefined && <small className="text-[10px] font-bold text-wk-muted">/{max}</small>}
      </span>
    </span>
  )
}
