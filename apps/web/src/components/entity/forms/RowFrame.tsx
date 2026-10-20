import type { CSSProperties, ReactNode } from 'react'

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
  /** Inline style on the frame: the select ring, a host's frame colour. */
  style?: CSSProperties | undefined
  /** The head, then the body. */
  children: ReactNode
}

/**
 * ROW FRAME — the Row's square 2px frame on paper (ruleset §4.3) and its main
 * column: the one place that markup is drawn. `Row` stands in it, and so does
 * the house container (`Box`, and on it `TitledBox` and the dialogs),
 * which is why a dialog's head and a listing's Row are one geometry (§0).
 */
export function RowFrame({
  userMade = false,
  reference = false,
  bodyless = false,
  shrink = false,
  style,
  children,
}: RowFrameProps) {
  return (
    <div
      className="su-entity-row__frame"
      // Print inks the frame (`styles/build/print.css`).
      data-handback=""
      data-user-made={userMade || undefined}
      data-reference={reference || undefined}
      data-bodyless={bodyless || undefined}
      data-shrink={shrink || undefined}
      style={style}
    >
      <div className="su-entity-row__main">{children}</div>
    </div>
  )
}

/**
 * The Row's paper body under its head: a lead, or a host's leading content.
 */
export function RowBody({
  style,
  children,
}: {
  style?: CSSProperties | undefined
  children: ReactNode
}) {
  return (
    <div className="su-entity-row__body" style={style}>
      {children}
    </div>
  )
}
