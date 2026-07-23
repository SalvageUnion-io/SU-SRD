import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'

import { cn } from '../../utils/cn'
import type { SizeRung } from '../../styles/sizing'
import { POSTER_STAMP } from '../chrome/posterStamp'
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
  /** Non-interactive read-out (role="img"); over-capacity segments read red. */
  readOnly?: boolean
  /** First 0-based segment index that reads as danger (status-bad) when lit. */
  danger?: number
  /**
   * Size on the canonical rung ladder (`src/styles/sizing.ts`) — the gauge has
   * two rungs:
   *
   *   `full` (default) — the multi-row poster gauge: big numeral + caption. A
   *          gauge is a destination readout, so its resting rung is `full`.
   *   `compact` — the single-row layout (the dashboard-instrument cue): label ·
   *          one segment row · value/max, all on one line — no big numeral, no
   *          caption, no multi-row split.
   */
  size?: Extract<SizeRung, 'full' | 'compact'>
  /**
   * Surface skin (RenderingMatrix `skin sheet|instrument`): `sheet` (default,
   * light paper ground — ink label + numeral) or `instrument` (a dark ground —
   * light label + numeral, recessed empty segments). Only the text/empty-segment
   * treatment changes; filled segments always use the `--tone` accent.
   */
  surface?: 'sheet' | 'instrument'
  /** Extra inline style on the root — chiefly to pin the `--tone` / `--tone-deep`
   * vars for a one-off tone (the dashboard instruments pass their tone here). */
  style?: CSSProperties
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
  readOnly,
  danger,
  size = 'full',
  surface = 'sheet',
  style,
  className,
}: VitalGaugeProps) {
  const onDark = surface === 'instrument'
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
  // Dense sizing (tighter gaps, smaller numerals) engages on long tracks.
  const isDense = max >= 12
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

  // Empty-segment fill differs by surface: recessed outline on a dark instrument
  // ground, paper on the light sheet.
  const emptyFill = onDark ? 'border-paper/35 bg-transparent' : 'border-ink/50 bg-paper'
  const segFill = (state: ReturnType<typeof trackSegmentState>): string =>
    state === 'off'
      ? emptyFill
      : state === 'danger'
        ? 'border-status-bad bg-status-bad'
        : 'border-[var(--tone-deep)] bg-[var(--tone)]'

  // COMPACT — the single-row instrument bar (dashboard cue): label · one segment
  // row · value/max on one line. No big numeral, caption, or multi-row split.
  if (size === 'compact') {
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: role=group is a keyboard widget (arrow keys adjust the value); the segment buttons carry the click semantics
      // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is dynamically group|img — both support aria-label — but biome can't resolve the ternary
      <div
        role={editable ? 'group' : 'img'}
        aria-label={summary}
        onKeyDown={editable ? onKeyDown : undefined}
        className={cn('flex w-full items-center gap-2', className)}
        style={style}
      >
        <span
          className={cn(
            'shrink-0 font-cond text-label font-bold uppercase leading-none tracking-caps',
            onDark ? 'text-paper' : 'text-ink'
          )}
        >
          {label}
        </span>
        <div className="flex min-w-0 flex-1 gap-[3px]">
          {Array.from({ length: segCount }, (_, i) => ({
            i,
            state: trackSegmentState(i, shown, max, dangerFrom),
          })).map(({ i, state }) => {
            const on = state !== 'off'
            const segClass = cn('h-[10px] min-w-0 flex-1 rounded-badge border', segFill(state))
            return editable ? (
              <button
                key={i}
                type="button"
                data-pip={on ? 'on' : 'off'}
                aria-label={`Set ${label} to ${i + 1}`}
                onClick={() => setValue(pipClickValue(i, shown))}
                className={cn(
                  segClass,
                  'cursor-pointer p-0 transition-transform duration-[120ms] motion-safe:hover:-translate-y-px'
                )}
              />
            ) : (
              <span key={i} data-pip={on ? 'on' : 'off'} className={segClass} />
            )
          })}
        </div>
        <span
          className={cn(
            'shrink-0 whitespace-nowrap font-cond text-caption font-bold leading-none tabular-nums',
            isOver ? 'text-status-bad' : onDark ? 'text-paper' : 'text-ink'
          )}
        >
          {shown}/{max}
        </span>
      </div>
    )
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role=group is a keyboard widget (arrow keys adjust the value); the segment buttons carry the click semantics
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is dynamically group|img — both support aria-label — but biome can't resolve the ternary
    <div
      role={editable || editableMax ? 'group' : 'img'}
      aria-label={summary}
      onKeyDown={editable ? onKeyDown : undefined}
      className={cn('w-full py-1', className)}
      style={style}
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
        {/* The numeral sizes below are off-ladder ON PURPOSE, not un-burnt debt:
            the type scale runs nano 8 … lede 15 and then jumps to display 26,
            so the 16–30px band the gauge numeral lives in has no rung at all.
            The nearest rung to the hero numeral is display (26px), 7–13% below
            it — a visible shrink of the one figure the gauge exists to show.
            Closing this needs new rungs in theme.css (a ladder decision, and a
            repo-wide one: WizShell, AppBar, CountStepper, ModeDoor, SheetHero
            and ITUN's PilotSheet all reach into the same empty band), not a
            local substitution. */}
        <span className="whitespace-nowrap font-cond font-bold leading-none tabular-nums">
          <b
            className={cn(
              'font-bold',
              isOver ? 'text-status-bad' : 'text-ink',
              isDense ? 'text-display' : 'text-display-lg'
            )}
          >
            {shown}
          </b>
          <i className={cn('px-0.5 not-italic text-readout text-ink/55')}>/</i>
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
                'w-14 rounded-card border border-ink/40 bg-paper px-1 text-center text-readout tabular-nums text-ink'
              )}
            />
          ) : editableMax ? (
            <button
              type="button"
              onClick={beginEditMax}
              aria-label={`Override ${label} max (currently ${max})`}
              className={cn(
                'cursor-pointer rounded-badge px-0.5 text-readout underline decoration-dotted underline-offset-2',
                isOverridden ? 'text-[var(--tone-deep)]' : 'text-ink/70'
              )}
            >
              {max}
            </button>
          ) : (
            <span className={cn('text-readout text-ink/70')}>{max}</span>
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
              const segClass = cn(
                'min-h-0 min-w-0 flex-1 border-chrome p-0',
                isDense ? 'h-[18px] rounded-badge' : 'h-[22px] rounded-card',
                segFill(state)
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
      <div className="mt-1.5 flex items-center justify-end gap-1 font-cond text-nano font-semibold uppercase leading-none tracking-eyebrow text-ink/55">
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
