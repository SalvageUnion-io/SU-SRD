import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, space } from '../../design/tokens'

type MessageTone = 'bad' | 'warn' | 'info' | 'ok'

/** A step of the spacing scale, for the line's call-site margin. */
type SpaceStep = keyof typeof space

type MessageProps = {
  /** The message. Renders nothing when null/undefined/false/'' — call sites can pass a bare expression. */
  children?: ReactNode
  /** What the line reports. `bad` is announced as an alert; the rest as a status. */
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

/**
 * Each tone's ink at caption size. Only `statusBad` clears AA as text on
 * paper; the warn and ok status hues do not, so those lines print in ink and
 * carry their tone in their role and wording. `info` is the muted secondary
 * ink.
 */
const TONE_INK: Record<MessageTone, string> = {
  bad: color.statusBad,
  warn: color.ink,
  info: color.wkMuted,
  ok: color.ink,
}

/**
 * Message — the one single-line feedback message: a failure, a caution, a
 * note, a confirmation. One body line at caption size, in the tone's ink;
 * `bad` is `role="alert"`, every other tone `role="status"`.
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
      role={tone === 'bad' ? 'alert' : 'status'}
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
