import type { ComponentPropsWithRef, CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, radius, space, weight } from '../../design/tokens'
import { cn } from '../../utils/cn'
import { INPUT_FOCUS } from './interaction'

type RadioProps = Omit<ComponentPropsWithRef<'input'>, 'type'> & {
  /** Primary label (bold ink) — the option's name. */
  label: ReactNode
  /** Optional secondary line (muted) — a callsign, tech level, chassis, … */
  description?: ReactNode
  /**
   * Stack the bold label over its hint (a column) instead of setting them side
   * by side, and mark the chosen option with a 2px ink border. The pattern
   * visibility picker uses it: side by side, a narrow phone wraps the label
   * one word per line.
   */
  stacked?: boolean
}

/**
 * The framed choice row: a paper card with a 1.5px ink border (the same
 * paper / ink chrome `Input` wears), a native `<input>` at the left, then the
 * bold-ink label and an
 * optional muted description. Clicking anywhere on the row toggles it because
 * the whole row IS the `<label>` — native semantics, so screen readers get the
 * right role and radio groups arrow-key between options for free.
 */
const CHOICE_ROW = {
  alignItems: 'center',
  borderColor: color.ink,
  borderRadius: radius.card,
  borderStyle: 'solid',
  cursor: 'pointer',
  display: 'flex',
  gap: space[8],
} satisfies CSSProperties

/** Stacked: the label sits on the hint's first line, not centred on the pair. */
const CHOICE_ROW_STACKED = { ...CHOICE_ROW, alignItems: 'flex-start' } satisfies CSSProperties

/** The native input in the form vocabulary: an ink fill. */
const CHOICE_INPUT = { accentColor: color.ink } satisfies CSSProperties
const CHOICE_INPUT_STACKED = { ...CHOICE_INPUT, marginTop: space[2] } satisfies CSSProperties

const LABEL_TEXT = {
  color: color.ink,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  fontWeight: weight.medium,
  lineHeight: 'calc(1.25 / 0.875)',
} satisfies CSSProperties
const LABEL_TEXT_STACKED = { ...LABEL_TEXT, fontWeight: weight.bold } satisfies CSSProperties

const DESCRIPTION = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
} satisfies CSSProperties

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[2],
  minWidth: 0,
} satisfies CSSProperties

/**
 * Single-choice radio in the form vocabulary (sibling of `Field`/`Input`): a
 * real `<input type="radio">` inside a framed `<label>` row, so the label
 * selects it and the native round shape carries the mutually-exclusive
 * semantics (group members share a `name`; arrow keys move between them
 * natively). Same paper / 1.5px-ink chrome and focus ring as `Input`. Use for a
 * one-of-many selector dialog.
 */
export function Radio({
  label,
  description,
  stacked = false,
  className,
  style,
  ...props
}: RadioProps) {
  const text = (
    <>
      <span style={stacked ? LABEL_TEXT_STACKED : LABEL_TEXT}>{label}</span>
      {description != null && <span style={DESCRIPTION}>{description}</span>}
    </>
  )
  return (
    <label
      className={cn('su-choice', stacked && 'su-choice--stacked', className)}
      style={stacked ? CHOICE_ROW_STACKED : CHOICE_ROW}
    >
      <input
        type="radio"
        className={INPUT_FOCUS}
        style={{ ...(stacked ? CHOICE_INPUT_STACKED : CHOICE_INPUT), ...style }}
        {...props}
      />
      {stacked ? <span style={STACK}>{text}</span> : text}
    </label>
  )
}
