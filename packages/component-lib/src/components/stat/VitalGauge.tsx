import type { CSSProperties, KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { StatBreakdown } from 'salvageunion-reference/rules'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from '../../design/tokens'
import type { SizeRung } from '../../styles/sizing'
import { capsLabel } from '../chrome/capsLabel'
import { POSTER_STAMP } from '../chrome/posterStamp'
import { Stat } from '../shared/Stat'
import { pipClickValue, segmentLit, statBlockRowStarts, trackSegmentState } from './pipRows'
import type { ProvenanceLine } from './StatProvenance'
import { StatProvenance } from './StatProvenance'

/**
 * The two fields of a `StatBreakdown` the gauge reads: the override flag and
 * the derived value it reverts to. Pass the breakdown itself.
 */
export type VitalGaugeBreakdown = Pick<StatBreakdown, 'overridden' | 'derived'>

export type VitalGaugeProps = {
  /** Stamp label, e.g. 'HP', 'SP', 'Heat'. */
  label: string
  /** Optional muted sub-label after the stamp (e.g. mech-frame 'Structure'). */
  subLabel?: string
  /**
   * The track's cap, read beside the stamp as a `Cap | N` Stat chip (ruleset
   * §3.7: a cap is a `label | value`, so it is a Stat, never bare text). The
   * `full` rung only; the Dashboard's Heat track passes it (board D4).
   */
  cap?: number
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
   */
  provenance?: ProvenanceLine[]
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
   *   `compact` — the instrument layout (the dashboard cue): label · the pips ·
   *          value/max on one line, no big numeral, no caption. Its pips take
   *          the §4.5 row split, each a sixth of the bay wide.
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
 *
 * Styling follows the per-property split (ADR-046): static geometry, type and colour as
 * the style objects below; the hover-only halves (the segment lift, the muted
 * glyphs that ink on hover, the provenance triggers, which take no `style`) as
 * `.su-vital-gauge__*` in `styles/index.css`.
 */

const TABULAR: CSSProperties = { fontVariantNumeric: 'tabular-nums' }

/** An editable segment's static half; the hover lift is `.su-vital-gauge__pip`. */
const PIP_BUTTON: CSSProperties = {
  cursor: 'pointer',
  padding: space[0],
  transitionProperty: 'transform, translate, scale, rotate',
  transitionDuration: '120ms',
  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
}

// — compact —
const C_READOUT: CSSProperties = {
  display: 'flex',
  minWidth: 0,
  flex: 1,
  flexDirection: 'column',
  gap: space[4],
}
const C_HEAD: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: space[8],
}
const C_LABEL: CSSProperties = { flexShrink: 0, lineHeight: 1 }
const C_VALUE: CSSProperties = {
  ...TABULAR,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  fontFamily: font.cond,
  fontSize: fontSize.caption,
  fontWeight: weight.bold,
  lineHeight: 1,
}
const C_ROWS: CSSProperties = {
  display: 'flex',
  minWidth: 0,
  flexDirection: 'column',
  gap: '3px',
}
const C_ROW: CSSProperties = {
  display: 'flex',
  minWidth: 0,
  justifyContent: 'center',
  gap: '3px',
}
const C_PIP: CSSProperties = {
  height: '14px',
  width: 'calc((100% - 15px) / 6)',
  minWidth: 0,
  flexShrink: 0,
  borderRadius: radius.badge,
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
}
const C_SHELL: CSSProperties = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  gap: space[8],
}
const C_IMAGE: CSSProperties = { display: 'flex', minWidth: 0, flex: 1 }

// — full —
const ROOT: CSSProperties = { width: '100%', paddingBlock: space[4] }
const HEAD: CSSProperties = {
  marginBottom: space[8],
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: space[10],
}
const HEAD_LEFT: CSSProperties = {
  display: 'flex',
  minWidth: 0,
  alignItems: 'baseline',
  gap: space[6],
}
const STAMP: CSSProperties = {
  padding: '0.1em 0.5em 0.16em',
  fontSize: fontSize.caption,
  lineHeight: 1.5,
}
const SUB_LABEL: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  lineHeight: 1,
  color: color.wkMuted,
}
const NUMERAL: CSSProperties = {
  ...TABULAR,
  whiteSpace: 'nowrap',
  fontFamily: font.cond,
  fontWeight: weight.bold,
  lineHeight: 1,
}
const SLASH: CSSProperties = {
  paddingInline: space[2],
  fontStyle: 'normal',
  fontSize: fontSize.readout,
  color: color.ink75,
}
const MAX_INPUT: CSSProperties = {
  ...TABULAR,
  width: '56px',
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
  borderColor: color.ink40,
  backgroundColor: color.paper,
  paddingInline: space[4],
  textAlign: 'center',
  fontSize: fontSize.readout,
  color: color.ink,
}
const MAX_BUTTON: CSSProperties = {
  cursor: 'pointer',
  borderRadius: radius.badge,
  paddingInline: space[2],
  fontSize: fontSize.readout,
  textDecorationLine: 'underline',
  textDecorationStyle: 'dotted',
  textUnderlineOffset: '2px',
}
const MAX_TEXT: CSSProperties = { fontSize: fontSize.readout, color: color.ink75 }
const OVERRIDE_SUP: CSSProperties = {
  marginLeft: space[2],
  fontSize: fontSize.badge,
  fontWeight: weight.bold,
  color: 'var(--tone-deep)',
}
const REVERT: CSSProperties = {
  marginLeft: space[4],
  cursor: 'pointer',
  verticalAlign: 'middle',
  fontSize: fontSize.caption,
  lineHeight: 1,
}
const PIP: CSSProperties = {
  minHeight: 0,
  minWidth: 0,
  flex: 1,
  borderWidth: borderWidth.chrome,
  // `solid`: the base layer's `button { border: none }` leaves an editable
  // segment with no border style, so an unlit pip vanished in Edit while Read
  // drew it.
  borderStyle: 'solid',
  padding: space[0],
}
const PIP_DENSE: CSSProperties = { height: '18px', borderRadius: radius.badge }
const PIP_ROOMY: CSSProperties = { height: '22px', borderRadius: radius.card }
const CAPTION: CSSProperties = {
  marginTop: space[6],
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: space[4],
  lineHeight: 1,
  color: color.ink75,
}
const CAPTION_OVERRIDE: CSSProperties = {
  marginRight: 'auto',
  letterSpacing: tracking.capsSnug,
  color: 'var(--tone-deep)',
}

export function VitalGauge({
  label,
  subLabel,
  cap,
  value,
  max,
  onChange,
  onMaxChange,
  breakdown,
  onRevertOverride,
  provenance,
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
  const [capLeft, capRight] = caption ?? ['Current', 'Max']
  // A read-out prints without the default caption: the numeral already says
  // current / max. A caller's own caption always shows.
  const showCaption = !readOnly || caption !== undefined

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
  const emptyFill: CSSProperties = onDark
    ? { borderColor: color.paper30, backgroundColor: 'transparent' }
    : { borderColor: color.ink50, backgroundColor: color.paper }
  // An unlit pip past the redline keeps the empty ground and takes the
  // status-bad outline (boards D1, D4): the redline reads before the value
  // reaches it — on the sheet and the Dashboard alike, since both draw this gauge.
  const redlineFill: CSSProperties = {
    borderColor: color.statusBad,
    backgroundColor: onDark ? 'transparent' : color.paper,
  }
  const segFill = (state: ReturnType<typeof trackSegmentState>): CSSProperties =>
    state === 'off'
      ? emptyFill
      : state === 'redline'
        ? redlineFill
        : state === 'danger'
          ? { borderColor: color.statusBad, backgroundColor: color.statusBad }
          : { borderColor: 'var(--tone-deep)', backgroundColor: 'var(--tone)' }

  // COMPACT — the instrument bar (dashboard cue): label and value/max on one row,
  // the §4.5 pip rows beneath. No big numeral or caption.
  if (size === 'compact') {
    const readout = (
      <div style={C_READOUT}>
        {/* Board D2: the label and the value share one row, the pips sit below. */}
        <div style={C_HEAD}>
          <span
            className={capsLabel({ size: 'badge', tracking: 'caps' })}
            style={{ ...C_LABEL, color: onDark ? color.paper : color.ink }}
          >
            {label}
          </span>
          <span
            style={{
              ...C_VALUE,
              color: isOver ? color.statusBad : onDark ? color.paper : color.ink,
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
        <div style={C_ROWS}>
          {statBlockRowStarts(segCount).map((segRow) => (
            <div key={segRow.start} style={C_ROW}>
              {Array.from({ length: segRow.count }, (_, c) => {
                const i = segRow.start + c
                const state = trackSegmentState(i, shown, max, dangerFrom)
                const on = segmentLit(state)
                const segStyle: CSSProperties = { ...C_PIP, ...segFill(state) }
                return editable ? (
                  <button
                    key={i}
                    type="button"
                    data-pip={on ? 'on' : 'off'}
                    aria-label={`Set ${label} to ${i + 1}`}
                    onClick={() => setValue(pipClickValue(i, shown))}
                    className="su-vital-gauge__pip"
                    style={{ ...segStyle, ...PIP_BUTTON }}
                  />
                ) : (
                  <span key={i} data-pip={on ? 'on' : 'off'} style={segStyle} />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
    /*
     * Guided Play teaches as it enforces (ADR-021), so the compact instrument
     * carries provenance too: this branch must not return before the
     * override/provenance chrome, or the Dashboard drops both props.
     *
     * The trigger is held to the WCAG 2.5.8 24×24px target: as a bare glyph it
     * measured about 10×8px, and stacked gauges sit too close for the spacing
     * exception.
     */
    const trigger = provenance && (
      <StatProvenance
        statLabel={`Max ${label}`}
        lines={provenance}
        total={max}
        overridden={isOverridden}
        className={
          onDark
            ? 'su-vital-gauge__prov-compact su-vital-gauge__prov-compact--on-dark'
            : 'su-vital-gauge__prov-compact'
        }
      >
        {isOverridden ? '*' : 'ⓘ'}
      </StatProvenance>
    )
    // A read-only gauge is an image, and an image may not contain a control
    // (axe `nested-interactive`): with a provenance trigger the image wraps
    // the readout alone and the trigger sits beside it.
    if (!editable && trigger) {
      return (
        <div className={className} style={{ ...C_SHELL, ...style }}>
          <div role="img" aria-label={summary} style={C_IMAGE}>
            {readout}
          </div>
          {trigger}
        </div>
      )
    }
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: role=group is a keyboard widget (arrow keys adjust the value); the segment buttons carry the click semantics
      // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is dynamically group|img — both support aria-label — but biome can't resolve the ternary
      <div
        role={editable ? 'group' : 'img'}
        aria-label={summary}
        onKeyDown={editable ? onKeyDown : undefined}
        className={className}
        style={{ ...C_SHELL, ...style }}
      >
        {readout}
        {trigger}
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
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role=group is a keyboard widget (arrow keys adjust the value); the segment buttons carry the click semantics
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is dynamically group|img|none — each set with a label it supports — but biome can't resolve the ternary
    <div
      role={interactive ? 'group' : trackIsImage ? undefined : 'img'}
      aria-label={trackIsImage ? undefined : summary}
      onKeyDown={editable ? onKeyDown : undefined}
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
            <span
              className={capsLabel({ size: 'badge', weight: 'inherit', tracking: 'caps' })}
              style={SUB_LABEL}
            >
              {subLabel}
            </span>
          )}
          {cap !== undefined && (
            <Stat orientation="horizontal" label="Cap" value={cap} size="mini" />
          )}
        </span>
        {/* The numeral sizes below are off-ladder ON PURPOSE, not un-burnt debt:
            the type scale runs nano 8 … lede 15 and then jumps to display 26,
            so the 16–30px band the gauge numeral lives in has no rung at all.
            The nearest rung to the hero numeral is display (26px), 7–13% below
            it — a visible shrink of the one figure the gauge exists to show.
            Closing this needs new rungs in theme.css (a ladder decision, and a
            repo-wide one: WizShell, AppBar, CountStepper, ModeDoor and ITUN's
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
              className="su-vital-gauge__prov-info"
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
              className="su-vital-gauge__revert"
              style={REVERT}
            >
              ↺
            </button>
          )}
        </span>
      </div>

      {/* Segmented track — balanced rows, max 6 per row (the pip-row split /
          "looping chips" rule; shared with the Stat tracker). */}
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the label is set only with role=img */}
      <div
        role={trackIsImage ? 'img' : undefined}
        aria-label={trackIsImage ? summary : undefined}
        style={{ display: 'flex', flexDirection: 'column', gap: trackGap }}
      >
        {statBlockRowStarts(segCount).map((segRow) => (
          <div key={segRow.start} style={{ display: 'flex', gap: trackGap }}>
            {Array.from({ length: segRow.count }).map((_, c) => {
              const i = segRow.start + c
              const state = trackSegmentState(i, shown, max, dangerFrom)
              const on = segmentLit(state)
              const segStyle: CSSProperties = {
                ...PIP,
                ...(isDense ? PIP_DENSE : PIP_ROOMY),
                ...segFill(state),
              }
              return editable ? (
                <button
                  key={i}
                  type="button"
                  data-pip={on ? 'on' : 'off'}
                  aria-label={`Set ${label} to ${i + 1}`}
                  onClick={() => setValue(pipClickValue(i, shown))}
                  className="su-vital-gauge__pip"
                  style={{ ...segStyle, ...PIP_BUTTON }}
                />
              ) : (
                <span key={i} data-pip={on ? 'on' : 'off'} style={segStyle} />
              )
            })}
          </div>
        ))}
      </div>

      {/* Caption — right-aligned Current / Max; an override note sits left. */}
      {(showCaption || isOverridden) && (
        <div
          className={capsLabel({ size: 'badge', weight: 'semibold', tracking: 'eyebrow' })}
          style={CAPTION}
        >
          {isOverridden && <span style={CAPTION_OVERRIDE}>overridden from {overriddenFrom}</span>}
          {showCaption && (
            <>
              <span>{capLeft}</span>
              <span>/</span>
              <span>{capRight}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
