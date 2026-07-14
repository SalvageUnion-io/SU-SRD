import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type MChipVariant = 'default' | 'call' | 'class'

const MCHIP_VALUE_VARIANTS: Record<MChipVariant, string> = {
  default: 'text-[13px] text-ink',
  call: 'whitespace-nowrap text-base text-ink',
  class: 'text-[13px] text-ink-2',
}

type MChipProps = {
  /** Black label tab, e.g. 'CALLSIGN' */
  label: string
  /** Uppercase cond value, e.g. '"Wrench"' */
  value: ReactNode
  /** `call` = 16px nowrap (callsign); `class` = 13px ink-2 */
  variant?: MChipVariant
  className?: string
}

/**
 * Identity meta chip (design-spec §2.10 `.mchip`): 1.5px ink frame with a
 * black label tab and an uppercase cond value cell.
 */
export function MChip({ label, value, variant = 'default', className }: MChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-stretch overflow-hidden rounded-[2px] border-chrome border-ink bg-paper',
        className
      )}
    >
      <span className="flex items-center bg-ink px-1.5 font-cond text-[9.5px] font-bold uppercase leading-none tracking-caps-wide text-paper">
        {label}
      </span>
      <span
        className={cn(
          'flex items-center px-[9px] py-[3px] font-cond font-bold uppercase leading-none',
          MCHIP_VALUE_VARIANTS[variant]
        )}
      >
        {value}
      </span>
    </span>
  )
}

type SpecProps = {
  /** Key cell, e.g. 'SV' */
  label: string
  value: ReactNode
  /** Optional '/max' suffix */
  max?: ReactNode
  /** Recolor to the cargo deep bronze */
  cargo?: boolean
  className?: string
}

/**
 * Chassis spec lozenge (design-spec §2.10 `.spec`): tiny ink key cell + bold
 * value with optional `/max`. `cargo` recolors to `--cargo-deep`.
 */
export function Spec({ label, value, max, cargo = false, className }: SpecProps) {
  return (
    <span
      className={cn(
        'inline-flex items-stretch overflow-hidden rounded-[2px] border-chrome',
        cargo ? 'border-cargo-deep' : 'border-ink',
        className
      )}
    >
      <span
        className={cn(
          'flex items-center px-1.5 font-cond text-[9px] font-bold uppercase leading-none text-paper',
          cargo ? 'bg-cargo-deep' : 'bg-ink'
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'flex items-baseline gap-0.5 px-1.5 py-0.5 font-body text-sm font-bold leading-none',
          cargo ? 'text-cargo-deep' : 'text-ink'
        )}
      >
        {value}
        {max != null && <small className="text-[10px] font-bold text-wk-muted">/{max}</small>}
      </span>
    </span>
  )
}
