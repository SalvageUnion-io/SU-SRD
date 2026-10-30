import type { CSSProperties, ReactNode } from 'react'
import { bandFrame } from '../parts/paint'

export type RowFrameProps = {
  /** Player-made: the frame dashed (ruleset §3.9). */
  userMade?: boolean
  /** A Play reference unit (ADR-051 §5): the frame dashed, read-only. */
  reference?: boolean
  /** Nothing under the head: the frame keeps the head's height. */
  bodyless?: boolean
  /**
   * The frame and its main column may shrink below their content's height:
   * a host whose height is capped (a dialog's) or set (a panel it fills),
   * whose body scrolls in what is left.
   */
  shrink?: boolean
  /** The head's band paint, which the frame wears (R38); none keeps the subtle ink-40. */
  band?: string | undefined
  /** Inline style on the frame: the select ring, a host's frame colour. */
  style?: CSSProperties | undefined
  /** The head, then the body. */
  children: ReactNode
}

/**
 * COMPACT FRAME — the Compact's square 2px frame on paper (ruleset §4.3), in its
 * band's paint (R38), and its main
 * column: the one place that markup is drawn. `Compact` stands in it, and so does
 * the house container (`Box`, and on it `TitledBox` and the dialogs),
 * which is why a dialog's head and a listing's Compact are one geometry (§0).
 */
export function CompactFrame({
  userMade = false,
  reference = false,
  bodyless = false,
  shrink = false,
  band,
  style,
  children,
}: RowFrameProps) {
  return (
    <div
      className="su-entity-compact__frame"
      // Print inks the frame (`styles/build/print.css`).
      data-handback=""
      data-user-made={userMade || undefined}
      data-reference={reference || undefined}
      data-bodyless={bodyless || undefined}
      data-shrink={shrink || undefined}
      style={{ ...bandFrame(band), ...style }}
    >
      <div className="su-entity-compact__main">{children}</div>
    </div>
  )
}

/**
 * The Compact's paper body under its head: a lead, or a host's leading content.
 */
export function CompactBody({
  style,
  children,
}: {
  style?: CSSProperties | undefined
  children: ReactNode
}) {
  return (
    <div className="su-entity-compact__body" style={style}>
      {children}
    </div>
  )
}
