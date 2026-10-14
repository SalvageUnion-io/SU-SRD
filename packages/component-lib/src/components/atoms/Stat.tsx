import type { CSSProperties, ReactElement } from 'react'
import type { EntityRef } from 'salvageunion-reference'
import { borderWidth, color, font, fontSize, radius, space, weight } from '../../design/tokens'
import { usePeekAttrs } from '../../entity/peekContext'
import type { SizeRung } from '../../styles/sizing'
import type { StampSurface } from './Badge'
import { Badge } from './Badge'
import type { EntityStatus } from './entityStatus'
import { Tooltip } from './Tooltip'
import { TRANSITION_COLORS } from './transition'

/**
 * The canonical stat/value primitive (canonical primitive language §2): the
 * label-first `[label | value]` cell, in either material — `surface="plate"`
 * (default, the stamp pair: every chip) or `surface="plain"` (running text).
 * With `mode="edit"` and `onChange` it grows a +/- stepper pair. There is no
 * other anatomy: the centred square value box was retired for chips.
 *
 * The plate is ONE canonical ink-on-paper cell — no per-stat fill or value
 * colour. State is carried entirely by the BORDER colour via the `state` prop
 * (see StatBorderState). A value with a `max` reads as `current /max` (current
 * prominent, /max muted). A fill bar is `VitalGauge`.
 */

/** Stat tone (a public alias retained for consumers that key colour by stat). */
export type StatTone = 'hp' | 'ap' | 'ep' | 'sp' | 'heat' | 'cargo' | 'cw' | 'default'
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

/** The plate halves' type, by rung (`.su-stat-plate--<rung>`). */
const PLATE_RUNG: Record<SizeRung, string> = {
  full: 'su-stat-plate--full',
  compact: 'su-stat-plate--compact',
  mini: 'su-stat-plate--mini',
}

/** `modified`'s extra 1px ink ring rides a class, not the style object. */
const STATE_RING_CLASS = 'su-stat--modified'

/** Joins the truthy class names (the plain-concatenation half of `cn`). */
function classes(...names: (string | false | null | undefined)[]): string | undefined {
  const joined = names.filter(Boolean).join(' ')
  return joined === '' ? undefined : joined
}

/** The inherited `text-xs` / `text-sm` rungs carry their paired line-height. */
const LINE_HEIGHT_XS = 'calc(1 / 0.75)'
const LINE_HEIGHT_SM = 'calc(1.25 / 0.875)'

type StatValue = number | string

/** The `[label | value]` cell. With `onChange` + `mode="edit"` it grows a
 * compact +/- stepper pair. */
type HorizontalValueProps = {
  /** Header code / label ('HP', 'Range', or a numeric tier). */
  label: StatValue
  /** The one anatomy; kept so a call site may still spell it out. */
  orientation?: 'horizontal'
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
   * `plain` is a text finish: `state`, `bgColor`/`textColor` and `inverse` all
   * style the plate and are inert on it.
   */
  surface?: 'plate' | 'plain'
  /** Optional max — renders the value as `value /max` (muted /max suffix on
   * `plate`; part of the bold reading on `plain`, which is unbroken text). */
  max?: number
  /** Optional second label line — renders the label cell as a two-line stack
   * (`label` on top, `bottomLabel` below), e.g. "Tech" / "Level". */
  bottomLabel?: StatValue
  /**
   * Ladder rung (styles/sizing.ts). This anatomy's resting state is a reading
   * cell, so it defaults to `full`; `compact` is the listing-row scale and
   * `mini` the seam-tag size (text-badge / 11px). One axis: a pair of booleans
   * could be combined into a rung that doesn't exist; a single `size` cannot.
   */
  size?: SizeRung
  inverse?: boolean
  /** inline-flex (default) vs flex. */
  inline?: boolean
  /** State overlay — drives the border colour only (see StatBorderState). */
  state?: StatBorderState
  /** Label-plate tint (raw CSS colours) — the CHIP role only (subheader
   * trait/datavalue cells, group labels). Tints the label cell, not a stat's
   * value. Stat readouts stay ink-canonical and use `state` instead. */
  bgColor?: string
  textColor?: string
  /** Edit layer: with `mode="edit"`, render a +/- stepper column to the cell's
   * right. `min` bounds the stepper (max is the readout cap when set). */
  onChange?: (value: number) => void
  mode?: 'read' | 'edit'
  min?: number
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
  /** The glossary entry the cell's label names (a measured keyword, "Damage |
   * 2 SP"): the cell Peeks it on hover (entity display language E4). */
  peek?: EntityRef
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
  const inner = renderStat(props)
  const peek = usePeekAttrs('peek' in props ? props.peek : undefined)
  if (!peek['data-peek']) return inner
  // The cell carries the Peek's address; the page's PeekHost does the rest.
  return (
    <span {...peek} style={{ display: 'inline-flex', flex: 'none', lineHeight: 1 }}>
      {inner}
    </span>
  )
}

function renderStat(props: StatProps) {
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
  surface = 'plate',
  size = 'full',
  inverse = false,
  inline = true,
  state = 'default',
  bgColor,
  textColor,
  onChange,
  mode = 'read',
  min = 0,
  step = 1,
  stepperLabel,
  hoverText,
  wrap = false,
  className,
}: HorizontalValueProps) {
  const mainSurface: StampSurface = inverse ? 'inverse' : 'on-ink'
  const valueSurface: StampSurface = inverse ? 'on-ink' : 'inverse'

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

  // The cell and both plate halves are classes, not style objects: a listing
  // repeats the cell on every row (ADR-046, repeated elements). Callers also
  // override the cell's `display` and `flex-shrink` by className (the sheet's
  // condensed bar folds cells with `su-sheet-live-stat-fold`), which an inline
  // style would beat. Only the chip role's tint stays inline.
  const cell = (
    <span
      className={classes(
        'su-stat-cell',
        STATE_BORDER_CLASS[state],
        !inline && 'su-stat-cell--block',
        wrap && 'su-stat-cell--wrap',
        state === 'modified' && STATE_RING_CLASS,
        className
      )}
    >
      <Badge
        shape="stamp"
        size="mini"
        surface={mainSurface}
        // Stretched to the FULL cell height (over the stamp's inline-block) so
        // the label's ink covers the whole cell, its text centred even when
        // the row stretches it; a two-line label (`bottomLabel`) stacks. The
        // CELL draws the single rounded border, so neither half keeps the
        // `inverse` plate's inset ring.
        className={classes(
          'su-stat-plate',
          PLATE_RUNG[size],
          'su-stat-plate--label',
          bottomLabel !== undefined && 'su-stat-plate--stack'
        )}
        style={bgColor || textColor ? { backgroundColor: bgColor, color: textColor } : undefined}
      >
        {bottomLabel !== undefined ? (
          <>
            <span>{label}</span>
            <span>{bottomLabel}</span>
          </>
        ) : (
          label
        )}
      </Badge>
      {value !== undefined && (
        <Badge
          shape="stamp"
          size="mini"
          surface={valueSurface}
          className={classes(
            'su-stat-plate',
            PLATE_RUNG[size],
            'su-stat-plate--value',
            // Wrapping, it narrows with its cell; a word longer than the row
            // breaks rather than being clipped.
            wrap && 'su-stat-plate--wrap'
          )}
        >
          {value}
          {max !== undefined && (
            <span
              style={{ color: inverse ? color.paper70 : color.wkMuted, fontWeight: weight.normal }}
            >
              /{max}
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

  const atMin = numericValue <= min
  const atMax = max !== undefined && numericValue >= max
  // Buttons sit SIDE BY SIDE after the value cell and stretch to its height, so
  // the stepper adds no vertical height to the row. The resting fill/ink and
  // the coarse-pointer 44px floor live in classes (they flip on hover / at sm).
  const stepClass = (atLimit: boolean) =>
    classes(
      'su-stat-step',
      inverse ? 'su-stat-step--on-ink' : 'su-stat-step--on-paper',
      !atLimit && 'su-stat-step--live'
    )
  const stepStyle = (atLimit: boolean) =>
    ({
      ...TRANSITION_COLORS,
      alignItems: 'center',
      borderColor: inverse ? color.paper : color.ink,
      borderRadius: radius.badge,
      borderStyle: 'solid',
      borderWidth: borderWidth.hairline,
      cursor: atLimit ? 'not-allowed' : 'pointer',
      display: 'flex',
      fontFamily: font.body,
      fontSize: size === 'compact' ? fontSize.xs : fontSize.sm,
      fontWeight: weight.bold,
      justifyContent: 'center',
      lineHeight: size === 'compact' ? LINE_HEIGHT_XS : LINE_HEIGHT_SM,
      width: size === 'compact' ? space[16] : space[20],
      ...(atLimit ? { opacity: 0.3 } : undefined),
    }) satisfies CSSProperties

  const stepName = stepperLabel ?? label
  return withHover(
    <span
      style={{ alignItems: 'stretch', display: 'inline-flex', gap: space[2], width: 'fit-content' }}
    >
      {cell}
      <button
        type="button"
        aria-label={`Decrease ${stepName}`}
        onClick={() => onChange?.(Math.max(min, numericValue - step))}
        disabled={atMin}
        className={stepClass(atMin)}
        style={stepStyle(atMin)}
      >
        −
      </button>
      <button
        type="button"
        aria-label={`Increase ${stepName}`}
        onClick={() =>
          onChange?.(max !== undefined ? Math.min(max, numericValue + step) : numericValue + step)
        }
        disabled={!!atMax}
        className={stepClass(!!atMax)}
        style={stepStyle(!!atMax)}
      >
        +
      </button>
    </span>
  )
}
