import type { CSSProperties, ReactNode } from 'react'
import { borderWidth, color, radius, space } from '../../design/tokens'
import { Eyebrow } from '../atoms/Eyebrow'

const BOX = {
  alignItems: 'center',
  border: `${borderWidth.chrome} dashed ${color.wkFaint}`,
  borderRadius: radius.card,
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[8],
  padding: space[12],
} satisfies CSSProperties

/** A label's place beside its field. */
const FIELD = {
  alignItems: 'center',
  display: 'flex',
  gap: space[4],
} satisfies CSSProperties

type AdderBoxProps = {
  /** The intake's fields and its commit button, in one wrapping row. */
  children: ReactNode
  /** Placement only (a margin above). */
  style?: CSSProperties
}

/**
 * ADDER BOX — the dashed "+ add" intake under a list: its fields and its
 * commit button in one wrapping row, in a faint dashed frame (dashed means
 * editable). `AdderField` sets a caps label beside a field.
 */
export function AdderBox({ children, style }: AdderBoxProps) {
  return <div style={style ? { ...BOX, ...style } : BOX}>{children}</div>
}

type AdderFieldProps = {
  label: ReactNode
  /** The field's id, which the label names. */
  htmlFor: string
  /** The field. */
  children: ReactNode
}

/** A muted caps label with its field beside it, inside an `AdderBox`. */
export function AdderField({ label, htmlFor, children }: AdderFieldProps) {
  return (
    <Eyebrow as="label" tone="muted" htmlFor={htmlFor} style={FIELD}>
      {label}
      {children}
    </Eyebrow>
  )
}
