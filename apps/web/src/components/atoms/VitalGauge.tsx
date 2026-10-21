import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { StatBreakdown } from 'salvageunion-reference/rules'
import { borderWidth, color, fontSize, radius, space, tracking, weight } from '../../design/tokens'
import type { Size } from '../../styles/sizing'
import { capsLabel } from './capsLabel'
import { FOCUS_RING } from './interaction'
import { pipClickValue, statBlockRowStarts, trackSegmentState } from './pipRows'
import { POSTER_STAMP } from './posterStamp'
import { StepButton } from './SmallButtons'
import type { ProvenanceLine } from './StatProvenance'
import { StatProvenance } from './StatProvenance'
import {
  C_HEAD,
  C_LABEL,
  C_PIP,
  C_READOUT,
  C_ROW,
  C_ROWS,
  C_SHELL,
  C_VALUE,
  STEP,
  STEPPERS,
} from './vitalGaugeCompact'
import {
  HEAD,
  HEAD_LEFT,
  MAX_BUTTON,
  MAX_INPUT,
  MAX_TEXT,
  NUMERAL,
  OVERRIDE_SUP,
  REVERT,
  SLASH,
  STAMP,
  SUB_LABEL,
} from './vitalGaugeFull'
import {
  M_CELL,
  M_CELL_SIDE,
  M_GRID,
  M_LABEL,
  M_SHELL,
  M_VALUE,
  miniColumns,
} from './vitalGaugeMini'
import { segment } from './vitalGaugeSegment'

/**
 * The two fields of a `StatBreakdown` the gauge reads: the override flag and
 * the derived value it reverts to. Pass the breakdown itself.
 */
type VitalGaugeBreakdown = Pick<StatBreakdown, 'overridden' | 'derived'>

export type VitalGaugeProps = {
  /** Stamp label, e.g. 'HP', 'SP', 'Heat'. */
  label: string
  /** Optional muted sub-label after the stamp (e.g. mech-frame 'Structure'). */
  subLabel?: string
  /** Current value. */
  value: number
  /** Track maximum (segment count). */
  max: number
  /**
   * Editable when supplied (and not readOnly): the track becomes ONE
   * `role="slider"` tab stop (arrow keys, Home, End), and a click on a segment
   * sets the value. The segments are pointer-only — never a tab stop each.
   */
  onChange?: (v: number) => void
  /**
   * Cap override (ADR-022, Free Edit): when supplied (and not readOnly) the Max
   * numeral becomes click-to-edit — pinning a new maximum. Omit to keep the max
   * a plain read-out (the Frozen snapshot never passes it).
   *
   * Called with EVERY committed number, including the one already shown. The
   * gauge cannot tell a pin that upgrades caught up with (stored, +0, reading
   * as derived) from no pin at all, so it must not swallow "type the derived
   * value back in" — that is how a player deletes such a pin. The caller
   * normalises (`pinFor`) and skips a write that changes nothing.
   */
  onMaxChange?: (nextMax: number) => void
  /**
   * The stat's `StatBreakdown` (ADR-029). Its `overridden` flag is the ONE
   * switch for every override mark — the `--tone-deep` numeral, the `*`, the
   * ↺ revert and the "overridden from N" caption — and `derived` is the value
   * named in them. The gauge never decides this by comparing numbers (ADR-022
   * amendment): "baseline ≠ max" disagrees with the breakdown's own ledger on a
   * pin equal to its derivation. Omit (or pass on a read-only surface) to show no override.
   */
  breakdown?: VitalGaugeBreakdown
  /**
   * Revert the cap override back to its derived baseline. Offered whenever the
   * breakdown is overridden — pass it alongside `onMaxChange` so a value that
   * reads as overridden can always be reverted.
   */
  onRevertOverride?: () => void
  /**
   * Ledger explaining how `max` was derived (ADR-029). When supplied, a small
   * marker beside the numeral opens the StatProvenance panel on hover, focus or
   * tap.
   *
   * It is deliberately NOT the numeral itself: the numeral is already the
   * click-to-edit override affordance, so one click would have to mean two
   * things. When the stat is overridden the existing `*` marker becomes the
   * trigger — it already signals "there is something here to explain".
   * The `full` rung's alone: Play's compact vitals are numbers only (ADR-029 §3).
   */
  provenance?: ProvenanceLine[]
  /**
   * The compact rung's − / + (Play's instrument): with `onChange`, a
   * `StepButton` pair after the track, each one step, clamped to 0…max — the
   * pair an editable `Stat` draws, at the line's Compact Size (44px on touch).
   * The sheet's `full` rung has none: its track is the control.
   */
  steppers?: boolean
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
   *   `compact` — the instrument layout (Play's cue): label · the pips ·
   *          value/max on one line, no big numeral, no caption. Its pips take
   *          the §4.5 row split, each a sixth of the bay wide.
   *   `mini` — HP cells (a crawler bay's crew lead, owner round 9: "a mini
   *          sized HP cell display … a square grid"): label · value/max over
   *          a square block of small square cells. No numeral, no caption.
   */
  size?: Extract<Size, 'full' | 'compact' | 'mini'>
  /** Extra inline style on the root — chiefly to pin the `--tone` / `--tone-deep`
   * vars for a one-off tone (Play's vitals pass their tone here). */
  style?: CSSProperties
  className?: string
}

/**
 * VitalGauge (poster design-spec `.gauge`): a horizontal full-width segmented
 * bar per stat. Label stamp (left) + big numeral (right) over ONE flex row of
 * `flex-1` segments dividing the full width by `max`; filled segments use the
 * per-sheet accent (`--tone` / `--tone-deep`), empty segments read paper. No
 * header tab, no unit bar, and on the sheet's rung no steppers — click a segment (`pipClickValue`
 * semantics) or arrow-key the track to set the value.
 *
 * An editable track is one `role="slider"` tab stop, so a sheet of gauges is a
 * handful of stops rather than one per pip (Cargo alone was 16), and its
 * `aria-valuetext` ("Heat 5 of 6, over redline") announces every change. A
 * slider's children are presentational, so the segments are plain spans: the
 * slider takes the click and reads the segment from `data-pip-index`.
 *
 * Distinct from `StatBlock` (which keeps serving rail / NPC / tally / spec-strip
 * / snapshot-bay consumers). Themes per sheet via the `--tone*` CSS vars.
 *
 * Styling follows the per-property split (ADR-046): static geometry, type and colour as
 * the style objects below; the hover-only halves (the segment lift, the muted
 * glyphs that ink on hover, the provenance triggers, which take no `style`) as
 * `.su-vital-gauge__*` in `styles/partials/atoms.css`.
 */

// — full —
const ROOT = { width: '100%', paddingBlock: space[4] } satisfies CSSProperties
const PIP = {
  minHeight: 0,
  minWidth: 0,
  flex: 1,
  borderWidth: borderWidth.chrome,
  // `solid`, set explicitly: a segment once rendered as a `<button>`, whose
  // base-layer `border: none` made an unlit pip vanish in Edit while Read drew it.
  borderStyle: 'solid',
  padding: 0,
} satisfies CSSProperties
const PIP_DENSE = { height: 'var(--size-mini)', borderRadius: radius.badge } satisfies CSSProperties
const PIP_ROOMY = { height: '22px', borderRadius: radius.card } satisfies CSSProperties
const CAPTION = {
  marginTop: space[6],
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: space[4],
  lineHeight: 1,
  color: color.ink75,
} satisfies CSSProperties
const CAPTION_OVERRIDE = {
  marginRight: 'auto',
  letterSpacing: tracking.capsSnug,
  color: 'var(--tone-deep)',
} satisfies CSSProperties

export function VitalGauge({
  label,
  subLabel,
  value,
  max,
  onChange,
  onMaxChange,
  breakdown,
  onRevertOverride,
  provenance,
  steppers = false,
  readOnly,
  danger,
  size = 'full',
  style,
  className,
}: VitalGaugeProps) {
  const editable = !readOnly && onChange !== undefined
  const editableMax = !readOnly && onMaxChange !== undefined
  // Read, never inferred — see `breakdown`.
  const isOverridden = breakdown?.overridden === true
  const overriddenFrom = breakdown?.derived
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
    // No `next !== max` guard: see `onMaxChange`.
    if (Number.isFinite(next) && next >= 0) onMaxChange?.(next)
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

  const summary = `${label} ${shown} of ${max}${isOver ? ' — over capacity' : ''}`
  // The slider's spoken value: the summary, plus the redline once a lit
  // segment sits past it (the same test that paints that segment danger).
  const valueText = `${summary}${shown > dangerFrom ? ', over redline' : ''}`

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

  // Segments are pointer-only spans (a slider's children are presentational),
  // so the slider takes the click and reads which segment was hit.
  const onTrackClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const raw = target.closest('[data-pip-index]')?.getAttribute('data-pip-index')
    if (raw == null) return
    setValue(pipClickValue(Number(raw), shown))
  }

  // An editable track, on either rung: ONE tab stop that names the stat,
  // carries the value and announces each change through `aria-valuetext`.
  const slider = (trackStyle: CSSProperties, rows: ReactNode) => (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={shown}
      aria-valuetext={valueText}
      onKeyDown={onKeyDown}
      onClick={onTrackClick}
      className={FOCUS_RING}
      style={trackStyle}
    >
      {rows}
    </div>
  )

  // MINI — HP cells: the label, a square block of small square cells beneath
  // it (`miniColumns`), lit from the first, and value/max under the block in
  // smaller type (owner, round 11).
  if (size === 'mini') {
    const cells = Array.from({ length: segCount }, (_, n) => n).map((i) =>
      segment(i, trackSegmentState(i, shown, max, dangerFrom), M_CELL, editable)
    )
    const gridStyle = {
      ...M_GRID,
      gridTemplateColumns: `repeat(${miniColumns(segCount)}, ${M_CELL_SIDE})`,
    } satisfies CSSProperties
    return (
      // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is dynamically group|img — both support aria-label — but biome can't resolve the ternary
      <div
        role={editable ? 'group' : 'img'}
        aria-label={summary}
        data-size="mini"
        className={className}
        style={{ ...M_SHELL, ...style }}
      >
        <span className={capsLabel({ size: 'badge' })} style={{ ...M_LABEL, color: color.ink }}>
          {label}
        </span>
        {editable ? slider(gridStyle, cells) : <div style={gridStyle}>{cells}</div>}
        <span style={{ ...M_VALUE, color: isOver ? color.statusBad : color.ink }}>
          {shown}/{max}
        </span>
      </div>
    )
  }

  // COMPACT — the instrument bar (Play's cue): label and value/max on one row,
  // the §4.5 pip rows beneath. No big numeral or caption.
  if (size === 'compact') {
    const compactRows = (
      <>
        {statBlockRowStarts(segCount).map((segRow) => (
          <div key={segRow.start} style={C_ROW}>
            {Array.from({ length: segRow.count }, (_, c) => segRow.start + c).map((i) =>
              segment(i, trackSegmentState(i, shown, max, dangerFrom), C_PIP, editable)
            )}
          </div>
        ))}
      </>
    )
    const readout = (
      <div style={C_READOUT}>
        {/* Board D2: the label and the value share one row, the pips sit below. */}
        <div style={C_HEAD}>
          <span className={capsLabel({ size: 'badge' })} style={{ ...C_LABEL, color: color.ink }}>
            {label}
          </span>
          <span
            style={{
              ...C_VALUE,
              color: isOver ? color.statusBad : color.ink,
            }}
          >
            {shown}/{max}
          </span>
        </div>
        {/*
         * Pips follow the §4.5 row split (`statBlockRowStarts`: at most six a
         * row, balanced, bottom-heavy) — the same split the sheet's gauges
         * draw, so Heat 6 is one row of 6, SP 12 is 6/6 and Cargo 16 is 5/5/6.
         * Every pip is one sixth of the bay (less the gaps) whatever its row
         * holds, so a pip's width stays steady; a shorter row sits centred.
         */}
        {editable ? slider(C_ROWS, compactRows) : <div style={C_ROWS}>{compactRows}</div>}
      </div>
    )
    // Play's vitals are numbers only (ADR-029 §3): provenance and the max
    // override live on the sheet, so the compact rung draws neither.
    return (
      // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is dynamically group|img — both support aria-label — but biome can't resolve the ternary
      <div
        role={editable ? 'group' : 'img'}
        aria-label={summary}
        className={className}
        style={{ ...C_SHELL, ...style }}
      >
        {readout}
        {editable && steppers ? (
          <span style={STEPPERS}>
            <StepButton
              aria-label={`Decrease ${label}`}
              disabled={shown <= 0}
              onClick={() => setValue(shown - 1)}
              style={STEP}
            >
              −
            </StepButton>
            <StepButton
              aria-label={`Increase ${label}`}
              disabled={shown >= max}
              onClick={() => setValue(shown + 1)}
              style={STEP}
            >
              +
            </StepButton>
          </span>
        ) : null}
      </div>
    )
  }

  // A read-only gauge is an image, and an image may not contain a control (axe
  // `nested-interactive`). When the read-only header still carries one — the
  // provenance trigger or ↺ — the track alone takes the image role.
  const interactive = editable || editableMax
  const headerControl = provenance !== undefined || (isOverridden && onRevertOverride !== undefined)
  const trackIsImage = !interactive && headerControl
  const trackGap = isDense ? '3px' : space[4]
  const trackStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: trackGap,
  } satisfies CSSProperties
  const pipBase = { ...PIP, ...(isDense ? PIP_DENSE : PIP_ROOMY) } satisfies CSSProperties
  const fullRows = (
    <>
      {statBlockRowStarts(segCount).map((segRow) => (
        <div key={segRow.start} style={{ display: 'flex', gap: trackGap }}>
          {Array.from({ length: segRow.count }, (_, c) => segRow.start + c).map((i) =>
            segment(i, trackSegmentState(i, shown, max, dangerFrom), pipBase, editable)
          )}
        </div>
      ))}
    </>
  )
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is dynamically group|img|none — each set with a label it supports — but biome can't resolve the ternary
    <div
      role={interactive ? 'group' : trackIsImage ? undefined : 'img'}
      aria-label={trackIsImage ? undefined : summary}
      className={className}
      style={{ ...ROOT, ...style }}
    >
      {/* Label stamp + big numeral */}
      <div style={HEAD}>
        <span style={HEAD_LEFT}>
          <span className={POSTER_STAMP} style={STAMP}>
            {label}
          </span>
          {subLabel && (
            <span className={capsLabel({ size: 'badge', weight: 'inherit' })} style={SUB_LABEL}>
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
            repo-wide one: WizShell, AppBar and the app's
            PilotSheet all reach into the same empty band), not a local
            substitution. */}
        <span style={NUMERAL}>
          <b
            style={{
              fontWeight: weight.bold,
              color: isOver ? color.statusBad : color.ink,
              fontSize: isDense ? fontSize.display : fontSize.displayLg,
            }}
          >
            {shown}
          </b>
          {/* The `current / max` cluster all sits on ONE ink rung. `ink-75`
              (6.87:1) is the nearest rung that clears AA at 17px (`ink/55` is
              3.64:1); the max sits on the same rung rather than a step above,
              because the hierarchy this gauge is built on is the 31px bold
              numeral against this whole cluster, not the 1-rung step inside it. */}
          <i style={SLASH}>/</i>
          {editingMax ? (
            <input
              ref={maxInputRef}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="done"
              value={maxDraft}
              onChange={(event) => setMaxDraft(event.target.value)}
              onKeyDown={onMaxKeyDown}
              onBlur={commitMax}
              aria-label={`Set ${label} max`}
              style={MAX_INPUT}
            />
          ) : editableMax ? (
            <button
              type="button"
              onClick={beginEditMax}
              aria-label={`Override ${label} max (currently ${max})`}
              className="su-vital-gauge__mini su-hit-area"
              style={{ ...MAX_BUTTON, color: isOverridden ? 'var(--tone-deep)' : color.ink75 }}
            >
              {max}
            </button>
          ) : (
            <span style={MAX_TEXT}>{max}</span>
          )}
          {isOverridden &&
            (provenance ? (
              <StatProvenance
                statLabel={`Max ${label}`}
                lines={provenance}
                total={max}
                overridden
                className="su-vital-gauge__prov-mark"
              >
                *
              </StatProvenance>
            ) : (
              <sup title={`Overridden from ${overriddenFrom}`} style={OVERRIDE_SUP}>
                *
              </sup>
            ))}
          {!isOverridden && provenance && (
            <StatProvenance
              statLabel={`Max ${label}`}
              lines={provenance}
              total={max}
              className="su-vital-gauge__prov-info su-vital-gauge__mini su-hit-area"
            >
              ⓘ
            </StatProvenance>
          )}
          {isOverridden && onRevertOverride && !editingMax && (
            <button
              type="button"
              onClick={onRevertOverride}
              aria-label={`Revert ${label} max to derived ${overriddenFrom}`}
              title={`Revert to derived (${overriddenFrom})`}
              className="su-vital-gauge__revert su-vital-gauge__mini su-hit-area"
              style={REVERT}
            >
              ↺
            </button>
          )}
        </span>
      </div>

      {/* Segmented track — balanced rows, max 6 per row (the pip-row split /
          "looping chips" rule; shared with the Stat tracker). Editable, it is
          the slider; a read-only track beside a header control, the image. */}
      {editable ? (
        slider(trackStyle, fullRows)
      ) : (
        // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the label is set only with role=img
        <div
          role={trackIsImage ? 'img' : undefined}
          aria-label={trackIsImage ? summary : undefined}
          style={trackStyle}
        >
          {fullRows}
        </div>
      )}

      {/* No Current / Max caption, in Read or Edit: the numeral already says
          current / max (owner's call, 2026-10-14: Edit looks like Read). An
          override note still says where the max came from. */}
      {isOverridden && (
        <div className={capsLabel({ size: 'badge', weight: 'semibold' })} style={CAPTION}>
          <span style={CAPTION_OVERRIDE}>overridden from {overriddenFrom}</span>
        </div>
      )}
    </div>
  )
}
