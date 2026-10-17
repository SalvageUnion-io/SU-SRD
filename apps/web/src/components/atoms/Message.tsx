import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, space } from '../../design/tokens'

/** What the line reports: a failure, the one tone a caller has needed. */
type MessageTone = 'bad'

/** A step of the spacing scale, for the line's call-site margin. */
type SpaceStep = keyof typeof space

type MessageProps = {
  /** The message. Renders nothing when null/undefined/false/'' — call sites can pass a bare expression. */
  children?: ReactNode
  /** What the line reports, announced as an alert. */
  tone: MessageTone
  /**
   * The ground it prints on. 'ink' prints in paper (an on-ink band, such as
   * the Shelves band), where none of the tone inks holds contrast.
   */
  ground?: 'paper' | 'ink'
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

/** Each tone's ink at caption size: `statusBad` clears AA as text on paper. */
const TONE_INK: Record<MessageTone, string> = { bad: color.statusBad }

/**
 * Message — the one single-line feedback message: a failure. One body line at
 * caption size, in the tone's ink, as `role="alert"`.
 *
 * A block-level `<span>`, not a `<p>`, so it is valid inside phrasing content.
 * `FieldError` is this line's `bad` tone under the validation name.
 */
export function Message({
  children,
  tone,
  ground = 'paper',
  spaceAbove,
  className,
  id,
}: MessageProps) {
  // An empty live region still announces on some screen readers.
  if (children === null || children === undefined || children === false || children === '') {
    return null
  }
  return (
    <span
      id={id}
      role="alert"
      className={className}
      style={{
        ...LINE,
        color: ground === 'ink' ? color.paper : TONE_INK[tone],
        ...(spaceAbove === undefined ? null : { marginTop: space[spaceAbove] }),
      }}
    >
      {children}
    </span>
  )
}
