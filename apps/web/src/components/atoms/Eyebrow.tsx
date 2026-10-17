import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { capsLabel } from './capsLabel'

/**
 * The tones an eyebrow is printed in. `muted` is `wkMuted`, the secondary-text
 * tone that clears WCAG AA on every light ground; `toneDeep` follows the
 * sheet's `--tone-deep`, falling back to ink.
 */
const TONE = {
  ink: 'su-eyebrow--ink',
  muted: 'su-eyebrow--muted',
  toneDeep: 'su-eyebrow--tone-deep',
} as const

type EyebrowTone = keyof typeof TONE

type EyebrowProps = {
  tone: EyebrowTone
  /** The element it renders; the label keeps its semantics (`label`, `h3`, …). */
  as?: 'span' | 'p' | 'div' | 'label' | 'h2' | 'h3'
  children: ReactNode
  id?: string
  /** For `as="label"`. */
  htmlFor?: string
  /** A stateful or layout hook from the caller (a hover colour, a grid area). */
  className?: string
  /** Placement only (margin, display, flex): never type or colour. */
  style?: CSSProperties
}

/** The class string an eyebrow wears: the badge rung, bold, `caps` tracking. */
const EYEBROW = cn('su-eyebrow', capsLabel({ size: 'badge', tracking: 'caps' }))

/**
 * The small condensed-caps label over or beside a value, a field or a list:
 * one size (badge), one weight (bold), one tracking (`caps`), in one of three
 * tones.
 */
export function Eyebrow({
  tone,
  as: Tag = 'span',
  children,
  id,
  htmlFor,
  className,
  style,
}: EyebrowProps) {
  const classes = cn(EYEBROW, TONE[tone], className)
  if (Tag === 'label') {
    return (
      <label id={id} htmlFor={htmlFor} className={classes} style={style}>
        {children}
      </label>
    )
  }
  return (
    <Tag id={id} className={classes} style={style}>
      {children}
    </Tag>
  )
}
