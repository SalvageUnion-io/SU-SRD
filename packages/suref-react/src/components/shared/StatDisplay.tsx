import { useState, useEffect, useRef, useCallback } from 'react'
import { SalvageUnionReference, EntitySchemaNames } from 'salvageunion-reference'
import type { EntitySchemaName, SURefEnumSchemaName } from 'salvageunion-reference'
import { cn } from '../../utils/cn'
import { Text } from '../base/Text'
import { Tooltip } from '../ui/tooltip'
import { ReferenceEntityDisplayTooltip } from '../referenceEntity/ReferenceEntityDisplayTooltip'
import type { EntityStatus } from './entityStatus'

/**
 * The canonical stat/value primitive (canonical primitive language §2). One
 * prop-controlled component with TWO anatomies — it absorbs the former
 * ValueDisplay (horizontal label|value) and StatControl (box + steppers):
 *
 *   orientation="horizontal"  -> the horizontal black/white [label | value].
 *   (default)                 -> the centred value box with pseudoheader stamps
 *                                above/below; mode="edit" adds +/- steppers.
 *
 * StatDisplay has NO pip mode: pip trackers were retired (use the value box; a
 * fill bar is `VitalGauge`), and the crawler-bay tally is its own `BayStatus`
 * primitive. Individual pips live in `VitalGauge` / `BayStatus`, never here.
 */

/** Stat tone (a public alias retained for consumers that key colour by stat). */
export type StatTone = 'hp' | 'ap' | 'ep' | 'sp' | 'heat' | 'cargo' | 'cw' | 'default'
/** A tri-state condition value (crawler-bay condition — see `BayStatus`). */
export type StatState = EntityStatus

type StatValue = number | string

/**
 * StatDisplay is a discriminated union over its two mutually-exclusive
 * anatomies, keyed on `orientation`:
 *
 *   { orientation: 'horizontal' } -> HorizontalValue (label|value)
 *   (default)                     -> ValueBox (centred box)
 *
 * Every prop is scoped to the anatomy that reads it. `Exact<>` (below) then
 * forbids every OTHER anatomy's props with `?: never`, so mixing anatomies —
 * e.g. a `[box]` `bg` on an `orientation="horizontal"` call — is a compile
 * error, not a silently-ignored prop. (A plain union can't do this: TS treats
 * a prop as "excess" only when it appears in NO member, so `bg` would slip
 * through on the horizontal member.)
 */

/** Every prop name any anatomy accepts — the domain `Exact<>` closes over. */
type StatPropKey =
  | 'label'
  | 'value'
  | 'max'
  | 'min'
  | 'bottomLabel'
  | 'orientation'
  | 'mode'
  | 'inverse'
  | 'compact'
  | 'xs'
  | 'onChange'
  | 'onClick'
  | 'hoverText'
  | 'entityTooltip'
  | 'flash'
  | 'disabled'
  | 'isOverMax'
  | 'bg'
  | 'valueColor'
  | 'borderColor'
  | 'bgColor'
  | 'textColor'
  | 'inline'
  | 'labelId'
  | 'ariaLabel'
  | 'className'

/** `T`, plus every stat prop NOT in `T` forbidden (`?: never`) — the exclusion
 * that makes the anatomies genuinely non-overlapping at the type level. */
type Exact<T extends Partial<Record<StatPropKey, unknown>>> = T &
  Partial<Record<Exclude<StatPropKey, keyof T>, never>>

/** [horizontal] `orientation="horizontal"` without `pips` — the former ValueDisplay.
 * With `onChange` + `mode="edit"` it grows a compact +/- stepper column — the
 * "compact stat display with steppers" (the horizontal peer of the box's edit mode). */
type HorizontalValueProps = Exact<{
  /** Header code / label ('HP', 'Range', or a numeric tier). */
  label: StatValue
  orientation: 'horizontal'
  value?: StatValue
  /** Optional second label line — renders the label cell as a two-line stack
   * (`label` on top, `bottomLabel` below), e.g. "Tech" / "Level". */
  bottomLabel?: StatValue
  compact?: boolean
  /** Extra-small (text-label / 10px) — the seam-tag size. */
  xs?: boolean
  inverse?: boolean
  /** inline-flex (default) vs flex. */
  inline?: boolean
  /** Label-cell background / text colour overrides (raw CSS colours). */
  bgColor?: string
  textColor?: string
  /** Outer border colour — a raw CSS colour applied as inline `style`. */
  borderColor?: string
  /** Edit layer: with `mode="edit"`, render a +/- stepper column to the cell's
   * right (mirrors the value box's edit anatomy). `max`/`min` bound the steppers. */
  onChange?: (value: number) => void
  mode?: 'read' | 'edit'
  max?: number
  min?: number
  /** When set, wrap the cell in the entity/keyword hover-tooltip — the trait
   * chip's detail-on-hover (resolves `label` within `schemaName`). Replaces the
   * former TraitKeywordDisplayView; unresolved refs render plain (no tooltip). */
  entityTooltip?: { schemaName: SURefEnumSchemaName; label: StatValue }
  className?: string
}>

/** [box] the default centred value box; `mode="edit"` adds steppers (former StatControl). */
type ValueBoxProps = Exact<{
  label: StatValue
  orientation?: 'vertical'
  value?: StatValue
  max?: number
  /** Minimum for edit-mode steppers. */
  min?: number
  /** Bottom pseudoheader stamp. */
  bottomLabel?: string
  labelId?: string
  disabled?: boolean
  onClick?: () => void
  onChange?: (value: number) => void
  mode?: 'read' | 'edit'
  /** Value-box fill / value-text colour overrides (Tailwind classes). */
  bg?: string
  valueColor?: string
  /** Border colour — a Tailwind class (default `border-su-black`). */
  borderColor?: string
  ariaLabel?: string
  compact?: boolean
  flash?: boolean
  inverse?: boolean
  isOverMax?: boolean
  hoverText?: string
  className?: string
}>

type StatDisplayProps = HorizontalValueProps | ValueBoxProps

export function StatDisplay(props: StatDisplayProps) {
  const inner = renderStatDisplay(props)
  const entityTooltip = 'entityTooltip' in props ? props.entityTooltip : undefined
  if (entityTooltip) {
    // Resolve the trait/keyword to a real entity; wrap in the hover-tooltip when
    // found (the former TraitKeywordDisplayView), else render plain.
    const { schemaName, label } = entityTooltip
    const entity = EntitySchemaNames.has(schemaName as EntitySchemaName)
      ? SalvageUnionReference.findIn(
          schemaName as EntitySchemaName,
          (t) => t.name.toLowerCase() === String(label).toLowerCase()
        )
      : undefined
    if (entity?.id) {
      return (
        <ReferenceEntityDisplayTooltip schemaName={schemaName} entityId={entity.id} openDelay={300}>
          {inner}
        </ReferenceEntityDisplayTooltip>
      )
    }
  }
  return inner
}

function renderStatDisplay(props: StatDisplayProps) {
  if (props.orientation === 'horizontal') return <HorizontalValue {...props} />
  return <ValueBox {...props} />
}

/* ------------------------------------------------------------------ *
 * Horizontal [label | value] — the former ValueDisplay. Black/white   *
 * pseudoheader pair; the combo is inviolable.                         *
 * ------------------------------------------------------------------ */
function HorizontalValue({
  label,
  value,
  bottomLabel,
  compact = false,
  xs = false,
  inverse = false,
  inline = true,
  bgColor,
  textColor,
  borderColor,
  onChange,
  mode = 'read',
  max,
  min = 0,
  className,
}: HorizontalValueProps) {
  const fontSize = xs ? 'text-label' : compact ? 'text-xs' : 'text-sm'
  const fontWeight = xs ? 'font-bold' : compact ? 'font-normal' : 'font-semibold'
  const mainVariant = inverse ? 'pseudoheaderInverse' : 'pseudoheader'
  const valueVariant = inverse ? 'pseudoheader' : 'pseudoheaderInverse'

  const cell = (
    <span
      className={cn(
        'shrink-0 grow-0 cursor-default items-stretch whitespace-nowrap border border-su-black',
        inline ? 'inline-flex' : 'flex',
        'w-fit',
        className
      )}
      style={borderColor ? { borderColor } : undefined}
    >
      <Text
        variant={mainVariant}
        as="span"
        className={cn(
          // Stretch to the cell height and center vertically (no whitespace above/
          // below the label); the value cell already centers the same way.
          'flex items-center justify-center uppercase',
          fontSize,
          fontWeight,
          // Two-line label cell (e.g. "Tech" / "Level") when a bottomLabel is set.
          bottomLabel !== undefined && 'flex-col leading-[0.95]'
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
      </Text>
      {value !== undefined && (
        <Text
          variant={valueVariant}
          as="span"
          className={cn('flex items-center uppercase', fontSize, fontWeight)}
        >
          {value}
        </Text>
      )}
    </span>
  )

  // COMPACT STAT WITH STEPPERS — the horizontal peer of the value box's edit
  // mode: the `[label|value]` cell with a small vertical +/- column to its
  // right. Read-only (no edit / no onChange) returns the bare cell, unchanged.
  const numericValue = typeof value === 'number' ? value : Number(value)
  const canEdit = mode === 'edit' && onChange !== undefined && Number.isFinite(numericValue)
  if (!canEdit) return cell

  const atMin = numericValue <= min
  const atMax = max !== undefined && numericValue >= max
  // Buttons sit SIDE BY SIDE after the value cell and stretch to its height, so
  // the stepper adds no vertical height to the row.
  const btnSize = compact ? 'w-4 text-xs' : 'w-5 text-sm'
  const btnResting = inverse
    ? 'border-paper bg-su-black text-paper'
    : 'border-ink bg-paper text-ink'
  const btnHover = inverse ? 'hover:bg-paper hover:text-su-black' : 'hover:bg-ink hover:text-paper'
  // `border` (1px) matches the value cell's `border border-su-black` — the
  // thicker `border-chrome` read heavy next to the compact cell.
  const btnBase =
    'flex min-h-11 items-center justify-center border border-ink font-mono font-bold leading-none transition-colors sm:min-h-0'

  return (
    <span className="inline-flex w-fit items-stretch gap-0.5">
      {cell}
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange?.(Math.max(min, numericValue - 1))}
        disabled={atMin}
        className={cn(
          btnBase,
          btnSize,
          btnResting,
          atMin ? 'cursor-not-allowed opacity-30' : cn('cursor-pointer', btnHover)
        )}
      >
        −
      </button>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() =>
          onChange?.(max !== undefined ? Math.min(max, numericValue + 1) : numericValue + 1)
        }
        disabled={!!atMax}
        className={cn(
          btnBase,
          btnSize,
          btnResting,
          atMax ? 'cursor-not-allowed opacity-30' : cn('cursor-pointer', btnHover)
        )}
      >
        +
      </button>
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Centred value box — the former StatDisplay; mode="edit" grows the   *
 * +/- stepper column (the former StatControl).                        *
 * ------------------------------------------------------------------ */
function ValueBox({
  label,
  value,
  max,
  min = 0,
  bottomLabel,
  labelId,
  disabled,
  onClick,
  onChange,
  mode = 'read',
  bg = 'bg-paper',
  valueColor = 'text-su-black',
  borderColor = 'border-su-black',
  ariaLabel,
  compact = false,
  flash = false,
  inverse = false,
  isOverMax = false,
  hoverText,
  className,
}: ValueBoxProps) {
  const [isFlashing, setIsFlashing] = useState(false)

  const combinedAriaLabel = ariaLabel || (bottomLabel ? `${label} ${bottomLabel}` : String(label))
  const trueBg = inverse ? 'bg-su-black' : bg
  const trueValueColor = inverse ? 'text-paper' : valueColor
  const trueBorderColor = isOverMax ? 'border-su-green' : borderColor

  useEffect(() => {
    if (!flash) return
    const startTimer = setTimeout(() => setIsFlashing(true), 0)
    const endTimer = setTimeout(() => setIsFlashing(false), 3000)
    return () => {
      clearTimeout(startTimer)
      clearTimeout(endTimer)
    }
  }, [flash])

  const boxRef = useRef<HTMLDivElement>(null)
  const topLabelRef = useRef<HTMLSpanElement>(null)
  const bottomLabelRef = useRef<HTMLSpanElement>(null)

  const scaleLabels = useCallback(() => {
    const box = boxRef.current
    if (!box) return
    const boxWidth = box.offsetWidth
    for (const ref of [topLabelRef, bottomLabelRef]) {
      const el = ref.current
      if (!el) continue
      el.style.transform = ''
      const labelWidth = el.scrollWidth
      if (labelWidth > boxWidth) {
        el.style.transform = `scaleX(${boxWidth / labelWidth})`
      }
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: label/bottomLabel/compact are intentional extra deps — label scaling must re-measure whenever the rendered text or size changes
  useEffect(() => {
    scaleLabels()
  }, [label, bottomLabel, compact, scaleLabels])

  if (value === undefined) return null

  const numericValue = typeof value === 'number' ? value : Number(value)
  const canEdit = mode === 'edit' && onChange !== undefined && Number.isFinite(numericValue)
  const atMin = numericValue <= min
  const atMax = max !== undefined && numericValue >= max
  const btnSize = compact ? 'h-3 w-3 text-micro' : 'h-4 w-4 text-xs'
  // Match the canonical button border (border-chrome border-ink bg-paper), same
  // as Btn / StepBtn; keep the invert-on-hover the box steppers have always had.
  const btnResting = inverse
    ? 'border-paper bg-su-black text-paper'
    : 'border-ink bg-paper text-ink'
  const btnHover = inverse ? 'hover:bg-paper hover:text-su-black' : 'hover:bg-ink hover:text-paper'

  const boxSize = compact ? 'h-8 min-w-8 px-0.5' : 'h-12 w-12'
  // Disabled state: reduce overall opacity to signal disabled while preserving
  // foreground/background contrast. The default bg-paper / text-su-black pair
  // has a 16:1 base ratio; at 60% opacity the effective ratio is ~9.6:1, still
  // well above the WCAG AA threshold of 4.5:1 for normal text.
  const disabledClass = disabled ? 'opacity-60' : ''

  const box = (
    // biome-ignore lint/a11y/useSemanticElements: a <fieldset> would break the flex stat-box layout; role="group" carries the same semantics
    <div
      role="group"
      className={cn(
        'flex flex-col items-center gap-0 overflow-visible',
        compact ? 'min-w-8' : 'w-12',
        disabledClass,
        className
      )}
      aria-label={combinedAriaLabel}
    >
      <Text
        ref={topLabelRef}
        variant="pseudoheader"
        as="span"
        className={cn(
          'z-[1] -mb-2 origin-center self-center whitespace-nowrap uppercase',
          compact ? 'text-label' : 'text-xs'
        )}
        id={labelId}
      >
        {label}
      </Text>
      {onClick ? (
        <button
          ref={boxRef as React.Ref<HTMLButtonElement>}
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-disabled={disabled || undefined}
          className={cn(
            'flex items-center justify-center border',
            boxSize,
            trueBg,
            trueBorderColor,
            compact ? 'border' : 'border-chrome',
            disabled
              ? 'pointer-events-none'
              : 'cursor-pointer hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange',
            isFlashing && 'animate-[growShrink_3s_ease-out] motion-reduce:animate-none'
          )}
          aria-label={combinedAriaLabel}
        >
          <span
            className={cn(
              'w-full overflow-hidden whitespace-nowrap text-center font-bold',
              trueValueColor,
              compact ? 'text-xs' : 'text-[0.85rem]'
            )}
          >
            {max !== undefined ? `${value}/${max}` : value}
          </span>
        </button>
      ) : (
        <div
          ref={boxRef}
          className={cn(
            'flex items-center justify-center border',
            boxSize,
            trueBg,
            trueBorderColor,
            compact ? 'border' : 'border-chrome',
            isFlashing && 'animate-[growShrink_3s_ease-out] motion-reduce:animate-none'
          )}
        >
          <span
            className={cn(
              'w-full overflow-hidden whitespace-nowrap text-center font-bold',
              trueValueColor,
              compact ? 'text-xs' : 'text-[0.85rem]'
            )}
          >
            {max !== undefined ? `${value}/${max}` : value}
          </span>
        </div>
      )}
      <Text
        ref={bottomLabelRef}
        variant="pseudoheader"
        as="span"
        className={cn(
          'z-[1] -mt-2 origin-center self-center whitespace-nowrap uppercase',
          compact ? 'text-label' : 'text-xs',
          !bottomLabel && 'invisible'
        )}
      >
        {bottomLabel || ' '}
      </Text>
    </div>
  )

  const content = canEdit ? (
    <div className="flex items-center gap-0.5">
      {box}
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() =>
            onChange?.(max !== undefined ? Math.min(max, numericValue + 1) : numericValue + 1)
          }
          disabled={!!atMax}
          className={`flex min-h-11 min-w-11 items-center justify-center border-chrome font-mono font-bold leading-none transition-colors sm:min-h-0 sm:min-w-0 ${btnSize} ${btnResting} ${
            atMax ? 'cursor-not-allowed opacity-30' : `cursor-pointer ${btnHover}`
          }`}
        >
          +
        </button>
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange?.(Math.max(min, numericValue - 1))}
          disabled={atMin}
          className={`flex min-h-11 min-w-11 items-center justify-center border-chrome font-mono font-bold leading-none transition-colors sm:min-h-0 sm:min-w-0 ${btnSize} ${btnResting} ${
            atMin ? 'cursor-not-allowed opacity-30' : `cursor-pointer ${btnHover}`
          }`}
        >
          −
        </button>
      </div>
    </div>
  ) : (
    box
  )

  if (hoverText) {
    return <Tooltip content={hoverText}>{content}</Tooltip>
  }

  return content
}
