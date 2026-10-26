import type { CSSProperties, ReactElement } from 'react'
import { color, fontSize, space, weight } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { atomsCopy } from '../../messages/components-atoms'
import type { Size } from '../../styles/sizing'
import { Badge } from './Badge'
import type { EntityStatus } from './entityStatus'
import { StepButton } from './SmallButtons'
import { Tooltip } from './Tooltip'

/**
 * The canonical stat/value primitive (canonical primitive language §2): the
 * label-first `[label | value]` cell, in either material — `surface="plate"`
 * (default, the stamp pair: every chip) or `surface="plain"` (running text).
 * With `mode="edit"` and `onChange` it grows a +/- stepper pair: the one
 * stepper for a count (ruleset §6.2), a sheet's Uses and a wizard's copies
 * alike; a vital's is `VitalGauge`'s `steppers`, the same `StepButton` pair.
 * There is no other anatomy: the centred square value box was retired for chips.
 *
 * The plate is ONE canonical ink-on-paper cell — no per-stat fill or value
 * colour. State is carried entirely by the BORDER colour via the `state` prop
 * (see StatBorderState). A value with a `max` reads as `current /max` (current
 * prominent, /max muted). A fill bar is `VitalGauge`.
 */

/** A tri-state condition value (e.g. a crawler bay's condition). */
export type StatState = EntityStatus

/**
 * The ONE lever that changes between stat states — it drives only the cell's
 * BORDER colour; fill, text, label and stamp are constant (canonical primitive
 * language: "hue encodes ontology; state is a treatment overlay"). Which value
 * maps to which state is the consumer's call ("at cap" is `good` for SP but
 * `critical` for Heat).
 *
 *   default  -> ink border (the resting state)
 *   good     -> mech   (full / at-cap-good)
 *   modified -> heavier solid ink frame, border plus a 1px ring (value changed from its base, e.g. a modified TL)
 *   caution  -> status-warn
 *   critical -> status-bad
 */
export type StatBorderState = 'default' | 'good' | 'modified' | 'caution' | 'critical'

/**
 * The horizontal cell's border by state, as a class: the cell repeats on every
 * row of a listing, so its frame is `.su-stat-cell` (ink) plus one of these,
 * not a style object (ADR-046, repeated elements).
 */
const STATE_BORDER_CLASS: Record<StatBorderState, string | undefined> = {
  default: undefined,
  good: 'su-stat-cell--good',
  modified: undefined,
  caution: 'su-stat-cell--caution',
  critical: 'su-stat-cell--critical',
}

/** The cell's height, its Size's (`.su-stat-cell--<size>`), as a button's at that Size. */
const CELL_SIZE: Record<Size, string> = {
  full: 'su-stat-cell--full',
  compact: 'su-stat-cell--compact',
  mini: 'su-stat-cell--mini',
}

/** The plate halves' type, by rung (`.su-stat-plate--<rung>`). */
const PLATE_SIZE: Record<Size, string> = {
  full: 'su-stat-plate--full',
  compact: 'su-stat-plate--compact',
  mini: 'su-stat-plate--mini',
}

/** `modified`'s extra 1px ink ring rides a class, not the style object. */
const STATE_RING_CLASS = 'su-stat--modified'

/** The inherited `text-xs` / `text-sm` rungs carry their paired line-height. */
/** The muted `/max` after a plate's value. */
const MAX_SUFFIX = { color: color.wkMuted, fontWeight: weight.normal } satisfies CSSProperties

const LINE_HEIGHT_XS = 'calc(1 / 0.75)'
const LINE_HEIGHT_SM = 'calc(1.25 / 0.875)'

type StatValue = number | string

/** The `[label | value]` cell. With `onChange` + `mode="edit"` it grows a
 * compact +/- stepper pair. */
type HorizontalValueProps = {
  /** Header code / label ('HP', 'Range', or a numeric tier). */
  label: StatValue
  value?: StatValue
  /**
   * The cell's MATERIAL — same geometry (`label` then `value`, inline), two
   * finishes (canonical primitive language §0: geometry is constant across
   * contexts; only materials, density and interactivity change).
   *
   *   `plate` (default) — the stamp pair on a bordered, rounded cell.
   *   `plain`           — RUNNING TEXT: `SP 9/13`, no plate, no border, no
   *                       radius. The label inherits the surrounding line's
   *                       colour and the reading is a `<b>` so a text container
   *                       can weight it (the sheet rail body does exactly this).
   *
   * `plain` exists because the linked-units rail is specified as running text
   * rather than plates, and that gap had grown its OWN primitive (`StatLine`)
   * arguing running text and plates were "different jobs". They are not: they
   * are one `label | value` cell in two materials, so the fix was this rung —
   * ruleset §3.7, every `label | value` renders through `Stat`.
   *
   * `plain` is a text finish: `state` styles the plate and is inert on it.
   */
  surface?: 'plate' | 'plain'
  /** Optional max — renders the value as `value /max` (muted /max suffix on
   * `plate`; part of the bold reading on `plain`, which is unbroken text). */
  max?: number
  /** Optional second label line — renders the label cell as a two-line stack
   * (`label` on top, `bottomLabel` below), e.g. "Tech" / "Level". */
  bottomLabel?: StatValue
  /**
   * The label's short form, read in its place on a phone ("SP" for
   * "Structure Points", so it fits). One label shows at a time.
   */
  shortLabel?: string
  /**
   * Ladder rung (styles/sizing.ts): the cell's height is its Size's, as a
   * button's at that Size is (hard rule R12). It defaults to `compact`, a
   * body's reading cell; `mini` is a head strip's and a listing row's. One
   * axis: a pair of booleans could be combined into a rung that doesn't
   * exist; a single `size` cannot.
   */
  size?: Size
  /** inline-flex (default) vs flex. */
  inline?: boolean
  /**
   * HOLLOW: a label-only chip drawn as an outline, its label in the line's
   * colour on no fill, for the absence of something (a unit in no Game reads
   * `Unassigned`). Plate material only.
   */
  hollow?: boolean
  /** State overlay — drives the border colour only (see StatBorderState). */
  state?: StatBorderState
  /** Edit layer: with `mode="edit"`, render a +/- stepper column to the cell's
   * right. `min` bounds the stepper (max is the readout cap when set). */
  onChange?: (value: number) => void
  mode?: 'read' | 'edit'
  min?: number
  /**
   * The stepper's upper bound where the reading has none to print: a wizard's
   * copy count, whose ceiling is what the shared budget still allows. `+`
   * disables at it; nothing draws it. With `max` set, the lower of the two.
   */
  ceiling?: number
  /**
   * Increment per press (default 1). The crawler Trading Bay trades scrap in
   * fixed exchange lots, so its quantity stepper moves by the lot size rather
   * than by one — it had grown a hand-assembled `StepButton` pair for exactly
   * that reason. A stepper that counts by N is the same control at a different
   * granularity, so the fix is this rung, not a bespoke cluster.
   */
  step?: number
  /**
   * Accessible-name stem for the +/- buttons — they read
   * `Decrease {stepperLabel}` / `Increase {stepperLabel}`. Defaults to `label`.
   *
   * The plate's visible `label` is a terse code ('SCRAP', 'QTY') sized for the
   * cell, while a stepper's accessible name wants the full noun phrase
   * ('contribution', 'trade amount by 5'). Hand-assembled steppers took their
   * name from the caller; this keeps that contract when they fold onto Stat.
   */
  stepperLabel?: string
  /** Plain-text hover explanation (the stat's glossary line). Same contract as
   * the value box's `hoverText` — a compact header cell states the SAME stat as
   * the full box, so it must be able to explain itself too. */
  hoverText?: string
  /**
   * A cell in a wrapping row whose value may be longer than the row is wide
   * (a hybrid class's `REQ | Augmentation or Gladiatorial` in a catalog
   * tile): alone on its line, the cell narrows to the row and its value wraps
   * onto more lines, rather than being clipped by the frame. A cell that fits
   * is unchanged. The label never wraps.
   */
  wrap?: boolean
  className?: string
}

type StatProps = HorizontalValueProps

export function Stat(props: StatProps) {
  return <HorizontalValue {...props} />
}

/* ------------------------------------------------------------------ *
 * Horizontal [label | value]. Ink/paper                               *
 * stamp pair, rounded; state rides the border.                        *
 * ------------------------------------------------------------------ */
function HorizontalValue({
  label,
  value,
  max,
  bottomLabel,
  shortLabel,
  surface = 'plate',
  size = 'compact',
  inline = true,
  hollow = false,
  state = 'default',
  onChange,
  mode = 'read',
  min = 0,
  ceiling,
  step = 1,
  stepperLabel,
  hoverText,
  wrap = false,
  className,
}: HorizontalValueProps) {
  // The hover explanation rides the OUTERMOST node of whichever anatomy we
  // return, so it works on the bare cell, the running-text finish and the
  // cell+stepper cluster alike. `Tooltip` is already inert inside a hovercard
  // (InsideTooltipContext), so nested cards need no extra suppression here.
  const withHover = (node: ReactElement) =>
    hoverText ? <Tooltip content={hoverText}>{node}</Tooltip> : node

  // PLAIN material — running text (`SP 9/13`). No plate, no border, no radius;
  // an inert inline `<span>` so it neither breaks the line's flow nor changes
  // how the surrounding sentence wraps. The reading (value AND `/max`) is one
  // unbroken `<b>`: on a text line the slash belongs to the number, so it is
  // not split off and muted the way the plate's `/max` suffix is.
  //
  // `plain` is a READ finish and returns here: a +/- stepper column belongs to
  // a cell with an edge, not to a word in a sentence, so `mode="edit"` has no
  // plain rendering (use the plate material when the stat is editable).
  if (surface === 'plain') {
    return withHover(
      <span className={className}>
        {label}
        {value !== undefined && (
          <>
            {' '}
            <b>
              {value}
              {max !== undefined && `/${max}`}
            </b>
          </>
        )}
      </span>
    )
  }

  const reserve = readingReserve(value, max)
  // The cell and both plate halves are classes, not style objects: a listing
  // repeats the cell on every row (ADR-046, repeated elements). Callers also
  // override the cell's `display` and `flex-shrink` by className (the sheet's
  // condensed bar folds cells with `su-sheet-live-stat-fold`), which an inline
  // style would beat. Only the chip role's tint stays inline.
  const cell = (
    <span
      className={cn(
        'su-stat-cell',
        CELL_SIZE[size],
        STATE_BORDER_CLASS[state],
        !inline && 'su-stat-cell--block',
        hollow && 'su-stat-cell--hollow',
        wrap && 'su-stat-cell--wrap',
        state === 'modified' && STATE_RING_CLASS,
        className
      )}
    >
      <Badge
        shape="stamp"
        size="mini"
        // One plate pair on every ground: on an ink ground (the frame's
        // `data-ground`, chrome K1) the cell keeps a paper rule, in CSS.
        surface="solid"
        // Stretched to the FULL cell height (over the stamp's inline-block) so
        // the label's ink covers the whole cell, its text centred even when
        // the row stretches it; a two-line label (`bottomLabel`) stacks. The
        // CELL draws the single rounded border, so neither half keeps the
        // `inverse` plate's inset ring.
        className={cn(
          'su-stat-plate',
          PLATE_SIZE[size],
          'su-stat-plate--label',
          bottomLabel !== undefined && 'su-stat-plate--stack'
        )}
      >
        {bottomLabel !== undefined ? (
          <>
            <span>{label}</span>
            <span>{bottomLabel}</span>
          </>
        ) : shortLabel !== undefined && shortLabel !== String(label) ? (
          <>
            <span className="su-stat-label--long">{label}</span>
            <span className="su-stat-label--short">{shortLabel}</span>
          </>
        ) : (
          label
        )}
      </Badge>
      {value !== undefined && (
        <Badge
          shape="stamp"
          size="mini"
          surface="inverse"
          className={cn(
            'su-stat-plate',
            PLATE_SIZE[size],
            'su-stat-plate--value',
            // Wrapping, it narrows with its cell; a word longer than the row
            // breaks rather than being clipped.
            wrap && 'su-stat-plate--wrap'
          )}
        >
          {reserve === undefined ? (
            <>
              {value}
              {max !== undefined && <span style={MAX_SUFFIX}>/{max}</span>}
            </>
          ) : (
            // A live reading reserves its maximum's width, in tabular figures
            // (C7): `9/13` takes the room `13/13` does, so it never shifts.
            <span className="su-stat-reading" style={{ minWidth: `${reserve}ch` }}>
              {value}
              {max !== undefined && <span style={MAX_SUFFIX}>/{max}</span>}
            </span>
          )}
        </Badge>
      )}
    </span>
  )

  // COMPACT STAT WITH STEPPERS — the horizontal peer of the value box's edit
  // mode: the `[label|value]` cell with a small vertical +/- column to its
  // right. Read-only (no edit / no onChange) returns the bare cell, unchanged.
  const numericValue = typeof value === 'number' ? value : Number(value)
  const canEdit = mode === 'edit' && onChange !== undefined && Number.isFinite(numericValue)
  if (!canEdit) return withHover(cell)

  const top = Math.min(max ?? Number.POSITIVE_INFINITY, ceiling ?? Number.POSITIVE_INFINITY)
  const atMin = numericValue <= min
  const atMax = numericValue >= top
  // A press never reaches the Stat's host: a picker card's own click adds a
  // copy, so a `−` that bubbled there would undo itself.
  const press = (next: number) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    onChange?.(next)
  }
  // Buttons sit SIDE BY SIDE after the value cell and stretch to its height, so
  // the stepper adds no vertical height to the row: the shared `StepButton` at
  // its `cell` fit, its plate set in CSS by the ground the Stat is printed on.
  const stepStyle = {
    fontSize: size === 'mini' ? fontSize.xs : fontSize.sm,
    lineHeight: size === 'mini' ? LINE_HEIGHT_XS : LINE_HEIGHT_SM,
    width: size === 'mini' ? space[16] : space[20],
  } satisfies CSSProperties

  const stepName = stepperLabel ?? label
  // The cell and its stepper are one chip (`su-stat-stepper`).
  return withHover(
    <span
      className="su-stat-stepper"
      style={{ alignItems: 'stretch', display: 'inline-flex', gap: space[2], width: 'fit-content' }}
    >
      {cell}
      <StepButton
        fit="cell"
        aria-label={atomsCopy('decrease', { stepName })}
        onClick={press(Math.max(min, numericValue - step))}
        disabled={atMin}
        style={stepStyle}
      >
        −
      </StepButton>
      <StepButton
        fit="cell"
        aria-label={atomsCopy('increase', { stepName })}
        onClick={press(Math.min(top, numericValue + step))}
        disabled={atMax}
        style={stepStyle}
      >
        +
      </StepButton>
    </span>
  )
}

/**
 * The characters a live reading reserves (C7): a reading out of its maximum
 * (`max`, or a `9/13` value) takes its maximum's width, `13/13`, and any word
 * after it (`4/5 Intact`); anything else reserves nothing.
 */
function readingReserve(value: StatValue | undefined, max: number | undefined): number | undefined {
  if (value === undefined) return undefined
  if (max !== undefined) return 2 * String(max).length + 1
  const reading = /^(\d+)\/(\d+)(.*)$/.exec(String(value))
  return reading?.[2] ? 2 * reading[2].length + 1 + (reading[3]?.length ?? 0) : undefined
}
