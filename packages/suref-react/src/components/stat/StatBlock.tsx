import { useState } from 'react'
import { cn } from '../../utils/cn'
import { StepBtn } from '../chrome/SmallButtons'
import { statBlockRowStarts, pipClickValue } from './pipRows'

/** Pip fill semantics: hp red, ap/ep rust, heat warn, cargo bronze, sp/default ink. */
export type StatBlockTone = 'hp' | 'ap' | 'ep' | 'sp' | 'heat' | 'cargo' | 'default'

/** Tri-state tally entry for the states[] mode (crawler bays). */
export type StatBlockState = 'intact' | 'damaged' | 'destroyed'

const PIP_FILL: Record<StatBlockTone, string> = {
  hp: 'border-status-bad bg-status-bad',
  ap: 'border-rust bg-rust',
  ep: 'border-rust bg-rust',
  heat: 'border-status-warn bg-status-warn',
  cargo: 'border-cargo bg-cargo',
  sp: 'border-ink bg-ink',
  default: 'border-ink bg-ink',
}

const TALLY_SWATCH: Record<StatBlockState, string> = {
  intact: 'border-status-ok bg-status-ok',
  damaged:
    'border-status-warn bg-[linear-gradient(135deg,var(--color-status-warn)_50%,transparent_50%)]',
  destroyed:
    'border-status-bad bg-[linear-gradient(45deg,transparent_42%,var(--color-status-bad)_42%,var(--color-status-bad)_58%,transparent_58%),linear-gradient(-45deg,transparent_42%,var(--color-status-bad)_42%,var(--color-status-bad)_58%,transparent_58%)]',
}

type StatBlockProps = {
  /** Header code, e.g. 'HP', 'STRUCTURE' */
  code: string
  /** Muted right-side header name, e.g. 'Hit Points' */
  name?: string
  /** Black footer bar label, e.g. 'POINTS' */
  unit?: string
  /** Pip fill semantics (default ink) */
  stat?: StatBlockTone
  /** lg (sheet hero) or sm (rail / NPC / spec strip) */
  size?: 'lg' | 'sm'
  /** Track maximum. Omit for unbounded counters (e.g. TP) — no pips. */
  max?: number
  /** Controlled value; pair with onChange for live editing */
  value?: number
  /** Uncontrolled initial value (self-managed state) */
  init?: number
  onChange?: (value: number) => void
  /** Force editability on/off; derived from value/onChange/init otherwise */
  editable?: boolean
  /** Set false to suppress pips even with a max (e.g. SYS 5/20) */
  pips?: boolean
  /** Tri-state tally mode (crawler bays) — replaces the numeric value/track */
  states?: StatBlockState[]
  /** Click handler per states[] pip */
  onBay?: (index: number) => void
  className?: string
}

/**
 * Live-sheet stat tracker (design-spec §2.7 `.sblock`): black code tab,
 * stepper-flanked value over a ≤6-per-row bottom-heavy pip track, black unit
 * bar. Controlled-optional (value/onChange or self-managed from init); clamps
 * 0..max; pips click-to-set per §4.5. The `states[]` mode renders a tri-state
 * bay tally (half-fill damaged / CSS-X destroyed) instead of the number row.
 */
export function StatBlock({
  code,
  name,
  unit,
  stat = 'default',
  size = 'lg',
  max,
  value: valueProp,
  init,
  onChange,
  editable,
  pips = true,
  states,
  onBay,
  className,
}: StatBlockProps) {
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = useState(init ?? max ?? 0)
  const rawValue = isControlled ? valueProp : internal
  const clamp = (v: number) => Math.max(0, max !== undefined ? Math.min(v, max) : v)
  const value = clamp(rawValue)

  // Editable when controlled-with-onChange or self-managed; a bare `value`
  // (e.g. mech Cargo derived from hold usage) is read-only.
  const isEditable = editable ?? (onChange !== undefined || !isControlled)
  const setValue = (next: number) => {
    if (!isEditable) return
    const clamped = clamp(next)
    if (!isControlled) setInternal(clamped)
    onChange?.(clamped)
  }

  const isStates = states !== undefined
  const isSm = size === 'sm'
  const showSteppers = !isStates && !isSm && isEditable
  const showPips = !isStates && pips && max !== undefined && max > 0

  const pipFill = PIP_FILL[stat]
  const pipBox = isSm
    ? 'h-2 w-2 rounded-[1px] border-[1.25px]'
    : 'h-[13px] w-[13px] rounded-[2px] border-[1.5px]'

  const tallies: { state: StatBlockState; count: number }[] = isStates
    ? (['intact', 'damaged', 'destroyed'] as const)
        .map((state) => ({
          state,
          count: states.filter((s) => s === state).length,
        }))
        .filter((t) => t.count > 0)
    : []

  return (
    <div
      role="group"
      aria-label={
        isStates
          ? `${code} ${states.length} bays`
          : `${code} ${value}${max !== undefined ? ` of ${max}` : ''}`
      }
      className={cn(
        'inline-flex flex-col overflow-hidden rounded-[3px] border-2 border-ink bg-paper shadow-[0_2px_6px_-2px_rgba(40,32,25,0.4)]',
        isSm && 'min-w-[96px]',
        className
      )}
    >
      {/* Black header tab */}
      <div className="flex items-center justify-between gap-2 bg-ink px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
        <span className="font-cond text-xs font-bold uppercase leading-none tracking-[0.12em] text-su-white">
          {code}
        </span>
        {name && (
          <span className="font-cond text-[9px] uppercase leading-none text-white/55">{name}</span>
        )}
      </div>

      {/* Main row: steppers + value, or the bay tally */}
      {isStates ? (
        <div className="flex items-center justify-center gap-3 px-2.5 py-1.5">
          {tallies.map(({ state, count }) => (
            <span key={state} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  'h-[11px] w-[11px] rounded-[1px] border-[1.5px]',
                  TALLY_SWATCH[state]
                )}
              />
              <span className="font-body text-[17px] font-bold leading-none text-ink">{count}</span>
              <span className="font-cond text-[9.5px] uppercase leading-none text-wk-muted">
                {state}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 px-2.5 py-1.5">
          {showSteppers && (
            <StepBtn aria-label={`Decrease ${code}`} onClick={() => setValue(value - 1)}>
              –
            </StepBtn>
          )}
          <span
            className={cn(
              'font-body font-bold leading-none text-ink',
              isSm ? 'text-base' : 'text-[23px]'
            )}
          >
            {value}
            {max !== undefined && (
              <small
                className={cn('font-bold text-wk-muted', isSm ? 'text-[10px]' : 'text-[13px]')}
              >
                /{max}
              </small>
            )}
          </span>
          {showSteppers && (
            <StepBtn aria-label={`Increase ${code}`} onClick={() => setValue(value + 1)}>
              +
            </StepBtn>
          )}
        </div>
      )}

      {/* Pip track */}
      {isStates ? (
        <div className="flex flex-col items-center gap-1 px-2.5 pb-2">
          {statBlockRowStarts(states.length).map(({ count, start }, r) => {
            return (
              <div key={r} className="flex justify-center gap-1">
                {Array.from({ length: count }).map((_, c) => {
                  const i = start + c
                  const state = states[i]!
                  const title = `Bay ${i + 1} · ${state}`
                  const pipClass = cn(pipBox, 'cursor-default', TALLY_SWATCH[state])
                  return onBay ? (
                    <button
                      key={i}
                      type="button"
                      title={title}
                      aria-label={title}
                      onClick={() => onBay(i)}
                      className={cn(pipClass, 'cursor-pointer')}
                    />
                  ) : (
                    <span key={i} title={title} className={pipClass} />
                  )
                })}
              </div>
            )
          })}
        </div>
      ) : (
        showPips && (
          <div
            className="flex flex-col items-center gap-1 px-2.5 pb-2"
            role="img"
            aria-label={`${value} of ${max}`}
          >
            {statBlockRowStarts(max!).map(({ count, start }, r) => {
              return (
                <div key={r} className="flex justify-center gap-1">
                  {Array.from({ length: count }).map((_, c) => {
                    const i = start + c
                    const on = i < value
                    const pipClass = cn(pipBox, on ? pipFill : 'border-ink bg-transparent')
                    return isEditable ? (
                      <button
                        key={i}
                        type="button"
                        tabIndex={-1}
                        aria-hidden="true"
                        data-pip={on ? 'on' : 'off'}
                        onClick={() => setValue(pipClickValue(i, value))}
                        className={cn(pipClass, 'cursor-pointer')}
                      />
                    ) : (
                      <span key={i} data-pip={on ? 'on' : 'off'} className={pipClass} />
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Black unit bar */}
      {unit && (
        <div className="bg-ink px-2 py-[3px] text-center font-cond text-[9.5px] font-bold uppercase leading-none tracking-[0.14em] text-su-white">
          {unit}
        </div>
      )}
    </div>
  )
}
