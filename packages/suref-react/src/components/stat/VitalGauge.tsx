import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { cn } from '../../utils/cn'
import { POSTER_STAMP } from '../chrome/Stamp'
import { pipClickValue, statBlockRowStarts, trackSegmentState } from './pipRows'

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
  /**
   * Cap override (ADR-022, Free Edit): when supplied (and not readOnly) the Max
   * numeral becomes click-to-edit — pinning a new maximum. Omit to keep the max
   * a plain read-out (the Frozen snapshot never passes it).
   */
  onMaxChange?: (nextMax: number) => void
  /**
   * The derived baseline this cap would compute to without a hand override.
   * When supplied, the max is flagged as overridden (a marker + "from N") and,
   * with `onRevertOverride`, a one-click revert-to-derived is offered.
   */
  overriddenFrom?: number
  /** Revert the cap override back to its derived baseline. */
  onRevertOverride?: () => void
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
  onMaxChange,
  overriddenFrom,
  onRevertOverride,
  caption,
  dense,
  readOnly,
  danger,
  className,
}: VitalGaugeProps) {
  const editable = !readOnly && onChange !== undefined
  const editableMax = !readOnly && onMaxChange !== undefined
  const isOverridden = overriddenFrom !== undefined && overriddenFrom !== max
  const [editingMax, setEditingMax] = useState(false)
  const [maxDraft, setMaxDraft] = useState('')
  const maxInputRef = useRef<HTMLInputElement>(null)
  // Guards commitMax against a double-fire: pressing Enter commits AND unmounts
  // the focused input, whose blur would otherwise commit a second time.
  const committedRef = useRef(false)

  // Focus the max input once, on entering edit mode (not on every render).
  useEffect(() => {
    if (editingMax) maxInputRef.current?.focus()
  }, [editingMax])

  const beginEditMax = () => {
    committedRef.current = false
    setMaxDraft(String(max))
    setEditingMax(true)
  }
  const commitMax = () => {
    if (committedRef.current) return
    committedRef.current = true
    setEditingMax(false)
    const next = Number.parseInt(maxDraft, 10)
    if (Number.isFinite(next) && next >= 0 && next !== max) onMaxChange?.(next)
  }
  const onMaxKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitMax()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      committedRef.current = true
      setEditingMax(false)
    }
  }
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
      role={editable || editableMax ? 'group' : 'img'}
      aria-label={summary}
      onKeyDown={editable ? onKeyDown : undefined}
      className={cn('w-full py-1', className)}
    >
      {/* Label stamp + big numeral */}
      <div className="mb-2 flex items-baseline justify-between gap-2.5">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span
            className={cn(
              POSTER_STAMP,
              'px-[0.5em] pb-[0.16em] pt-[0.1em] text-caption leading-[1.5]'
            )}
          >
            {label}
          </span>
          {subLabel && (
            <span className="truncate font-cond text-label uppercase leading-none tracking-caps text-wk-muted">
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
          {editingMax ? (
            <input
              ref={maxInputRef}
              type="number"
              value={maxDraft}
              onChange={(event) => setMaxDraft(event.target.value)}
              onKeyDown={onMaxKeyDown}
              onBlur={commitMax}
              aria-label={`Set ${label} max`}
              className={cn(
                'w-14 rounded-card border border-ink/40 bg-paper px-1 text-center tabular-nums text-ink',
                isDense ? 'text-[16px]' : 'text-[17px]'
              )}
            />
          ) : editableMax ? (
            <button
              type="button"
              onClick={beginEditMax}
              aria-label={`Override ${label} max (currently ${max})`}
              className={cn(
                'cursor-pointer rounded-badge px-0.5 underline decoration-dotted underline-offset-2',
                isOverridden ? 'text-[var(--tone-deep)]' : 'text-ink/70',
                isDense ? 'text-[16px]' : 'text-[17px]'
              )}
            >
              {max}
            </button>
          ) : (
            <span className={cn('text-ink/70', isDense ? 'text-[16px]' : 'text-[17px]')}>
              {max}
            </span>
          )}
          {isOverridden && (
            <sup
              title={`Overridden from ${overriddenFrom}`}
              className="ml-0.5 text-label font-bold text-[var(--tone-deep)]"
            >
              *
            </sup>
          )}
          {isOverridden && onRevertOverride && !editingMax && (
            <button
              type="button"
              onClick={onRevertOverride}
              aria-label={`Revert ${label} max to derived ${overriddenFrom}`}
              title={`Revert to derived (${overriddenFrom})`}
              className="ml-1 cursor-pointer align-middle text-caption leading-none text-wk-muted hover:text-ink"
            >
              ↺
            </button>
          )}
        </span>
      </div>

      {/* Segmented track — balanced rows, max 6 per row (the pip-row split /
          "looping chips" rule; shared with the Stat tracker). */}
      <div className={cn('flex flex-col', isDense ? 'gap-[3px]' : 'gap-1')}>
        {statBlockRowStarts(segCount).map((segRow) => (
          <div key={segRow.start} className={cn('flex', isDense ? 'gap-[3px]' : 'gap-1')}>
            {Array.from({ length: segRow.count }).map((_, c) => {
              const i = segRow.start + c
              const state = trackSegmentState(i, shown, max, dangerFrom)
              const on = state !== 'off'
              const fill =
                state === 'off'
                  ? 'border-[rgba(40,32,25,0.5)] bg-paper'
                  : state === 'danger'
                    ? 'border-status-bad bg-status-bad'
                    : 'border-[var(--tone-deep)] bg-[var(--tone)]'
              const segClass = cn(
                'min-h-0 min-w-0 flex-1 border-chrome p-0',
                isDense ? 'h-[18px] rounded-badge' : 'h-[22px] rounded-card',
                fill
              )
              return editable ? (
                <button
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
                <span key={i} data-pip={on ? 'on' : 'off'} className={segClass} />
              )
            })}
          </div>
        ))}
      </div>

      {/* Caption — right-aligned Current / Max; an override note sits left. */}
      <div className="mt-1.5 flex items-center justify-end gap-1 font-cond text-[8.5px] font-semibold uppercase leading-none tracking-eyebrow text-ink/55">
        {isOverridden && (
          <span className="mr-auto tracking-caps-snug text-[var(--tone-deep)]">
            overridden from {overriddenFrom}
          </span>
        )}
        <span>{capLeft}</span>
        <span>/</span>
        <span>{capRight}</span>
      </div>
    </div>
  )
}
