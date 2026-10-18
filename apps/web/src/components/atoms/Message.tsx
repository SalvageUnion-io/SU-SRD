import type { CSSProperties, ReactNode } from 'react'
import { font, fontSize, space } from '../../design/tokens'
import { cn } from '../../lib/cn'

/** What the line reports: a failure, the one tone a caller has needed. */
type MessageTone = 'bad'

/** A step of the spacing scale, for the line's call-site margin. */
type SpaceStep = keyof typeof space

type MessageProps = {
  /** The message. Renders nothing when null/undefined/false/'' — call sites can pass a bare expression. */
  children?: ReactNode
  /** What the line reports, announced as an alert. */
  tone: MessageTone
  /** Call-site spacing: the margin above the line, a step of the space scale. */
  spaceAbove?: SpaceStep
  /** Call-site classes (spacing only). Never restyle colour or type here. */
  className?: string
  /** DOM id, so a control can point at the line with `aria-describedby`. */
  id?: string
}

const LINE = {
  display: 'block',
  fontFamily: font.body,
  fontSize: fontSize.caption,
} satisfies CSSProperties

/**
 * Each tone's ink at caption size, a class (`.su-message--*`) because the
 * ground recolours it: `statusBad` clears AA as text on paper, and on an ink
 * ground (the frame's `data-ground`, chrome K1), where none of the tone inks
 * holds contrast, the line prints in paper.
 */
const TONE_CLASS: Record<MessageTone, string> = { bad: 'su-message--bad' }

/**
 * Message — the one single-line feedback message: a failure. One body line at
 * caption size, in the tone's ink, as `role="alert"`.
 *
 * A block-level `<span>`, not a `<p>`, so it is valid inside phrasing content.
 * `FieldError` is this line's `bad` tone under the validation name.
 */
export function Message({ children, tone, spaceAbove, className, id }: MessageProps) {
  // An empty live region still announces on some screen readers.
  if (children === null || children === undefined || children === false || children === '') {
    return null
  }
  return (
    <span
      id={id}
      role="alert"
      className={cn(TONE_CLASS[tone], className)}
      style={spaceAbove === undefined ? LINE : { ...LINE, marginTop: space[spaceAbove] }}
    >
      {children}
    </span>
  )
}
