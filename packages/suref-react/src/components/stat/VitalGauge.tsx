import type { KeyboardEvent } from 'react'

import { cn } from '../../utils/cn'
import { pipClickValue } from './pipRows'

export type VitalGaugeProps = {
  /** Stamp label, e.g. 'HP', 'SP', 'Heat'. */
  label: string
  /** Optional muted sub-label after the stamp (e.g. mech-frame 'Structure'). */
  subLabel?: string
  /** Current value. */
  value: number
  /** Track maximum (segment count). */
  max: number
  /** Editable when supplied (and not readOnly) — click a segment / arrow keys. */
  onChange?: (v: number) => void
  /** Caption pair, right-aligned under the track. Defaults to Current / Max. */
  caption?: [string, string]
  /** Dense sizing (h-18, gap-3). Auto-on at max ≥ 12 when unset. */
  dense?: boolean
  /** Non-interactive read-out (role="img"); over-capacity segments read red. */
  readOnly?: boolean
  /** First 0-based segment index that reads as danger (status-bad) when lit. */
  danger?: number
  className?: string
}

/** Black inline stamp label, cloned across wraps (design-spec `.stamp`). */
const STAMP =
  'box-decoration-clone inline bg-ink px-[0.5em] pb-[0.16em] pt-[0.1em] font-cond font-bold uppercase leading-[1.5] tracking-[0.09em] text-su-white'

/**
 * VitalGauge (poster design-spec `.gauge`): a horizontal full-width segmented
 * bar per stat. Label stamp (left) + big numeral (right) over ONE flex row of
 * `flex-1` segments dividing the full width by `max`; filled segments use the
 * per-sheet accent (`--tone` / `--tone-deep`), empty segments read paper. No
 * steppers, no header tab, no unit bar — click a segment (or arrow-key the
 * group) to set the value, `pipClickValue` semantics.
 *
 * Distinct from `StatBlock` (which keeps serving rail / NPC / tally / spec-strip
 * / snapshot-bay consumers). Themes per sheet via the `--tone*` CSS vars.
 */
export function VitalGauge({
  label,
  subLabel,
  value,
  max,
  onChange,
  caption,
  dense,
  readOnly,
  danger,
  className,
}: VitalGaugeProps) {
  const editable = !readOnly && onChange !== undefined
  const clamp = (v: number) => Math.min(Math.max(v, 0), max)
  // Read-only over-capacity is shown honestly (extra red segments); an editable
  // gauge is a bounded resource and always clamps 0..max.
  const shown = editable ? clamp(value) : Math.max(0, value)
  const isOver = shown > max
  const isDense = dense ?? max >= 12
  const segCount = Math.max(max, shown)
  const dangerFrom = danger ?? Number.POSITIVE_INFINITY
  const [capLeft, capRight] = caption ?? ['Current', 'Max']

  const summary = `${label} ${shown} of ${max}${isOver ? ' — over capacity' : ''}`

  const setValue = (next: number) => {
    if (!editable) return
    onChange?.(clamp(next))
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!editable) return
    let handled = true
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        setValue(shown + 1)
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        setValue(shown - 1)
        break
      case 'Home':
        setValue(0)
        break
      case 'End':
        setValue(max)
        break
      default:
        handled = false
    }
    if (handled) event.preventDefault()
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role=group is a keyboard widget (arrow keys adjust the value); the segment buttons carry the click semantics
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is dynamically group|img — both support aria-label — but biome can't resolve the ternary
    <div
      role={editable ? 'group' : 'img'}
      aria-label={summary}
      onKeyDown={editable ? onKeyDown : undefined}
      className={cn('w-full py-1', className)}
    >
      {/* Label stamp + big numeral */}
      <div className="mb-2 flex items-baseline justify-between gap-2.5">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className={cn(STAMP, 'text-[13px]')}>{label}</span>
          {subLabel && (
            <span className="truncate font-cond text-[10px] uppercase leading-none tracking-caps text-wk-muted">
              {subLabel}
            </span>
          )}
        </span>
        <span className="whitespace-nowrap font-cond font-bold leading-none tabular-nums">
          <b
            className={cn(
              'font-bold',
              isOver ? 'text-status-bad' : 'text-ink',
              isDense ? 'text-[28px]' : 'text-[30px]'
            )}
          >
            {shown}
          </b>
          <i
            className={cn('px-0.5 not-italic text-ink/55', isDense ? 'text-[16px]' : 'text-[17px]')}
          >
            /
          </i>
          <span className={cn('text-ink/70', isDense ? 'text-[16px]' : 'text-[17px]')}>{max}</span>
        </span>
      </div>

      {/* Segmented track — one flex row, never wraps */}
      <div className={cn('flex', isDense ? 'gap-[3px]' : 'gap-1')}>
        {Array.from({ length: segCount }).map((_, i) => {
          const on = i < shown
          const isDanger = on && (i >= max || i >= dangerFrom)
          const fill = !on
            ? 'border-[rgba(40,32,25,0.5)] bg-paper'
            : isDanger
              ? 'border-status-bad bg-status-bad'
              : 'border-[var(--tone-deep)] bg-[var(--tone)]'
          const segClass = cn(
            'min-h-0 min-w-0 flex-1 border-[1.5px] p-0',
            isDense ? 'h-[18px] rounded-[2px]' : 'h-[22px] rounded-[3px]',
            fill
          )
          return editable ? (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional — the index IS their identity
              key={i}
              type="button"
              data-pip={on ? 'on' : 'off'}
              aria-label={`Set ${label} to ${i + 1}`}
              onClick={() => setValue(pipClickValue(i, shown))}
              className={cn(
                segClass,
                'cursor-pointer transition-transform duration-[120ms] motion-safe:hover:-translate-y-px'
              )}
            />
          ) : (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional — the index IS their identity
              key={i}
              data-pip={on ? 'on' : 'off'}
              className={segClass}
            />
          )
        })}
      </div>

      {/* Caption — right-aligned Current / Max */}
      <div className="mt-1.5 flex justify-end gap-1 font-cond text-[8.5px] font-semibold uppercase leading-none tracking-[0.22em] text-ink/55">
        <span>{capLeft}</span>
        <span>/</span>
        <span>{capRight}</span>
      </div>
    </div>
  )
}
