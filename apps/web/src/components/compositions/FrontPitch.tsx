// MOCK (front): the front door's PITCH, the block under a front page's band:
// one value line in the title's condensed face, one sentence under it, the
// page's one rust action and one outline beside it, and a caption. The home,
// Build's front door and Play's signed-out hub all open on it, so the three
// sell themselves in one voice. Needed for a real build; not shipped code.
import type { ReactNode } from 'react'

type FrontPitchProps = {
  /** The value line: what this is, in one line. */
  value: string
  /** One sentence under it. */
  children?: ReactNode
  /** The rust primary, then the outline secondary (`Button size="full"`). */
  actions: ReactNode
  /** A caption under the actions (what needs an account). */
  note?: ReactNode
  /** The value line's heading level. */
  as?: 'h2' | 'p'
}

export function FrontPitch({ value, children, actions, note, as: Tag = 'p' }: FrontPitchProps) {
  return (
    <div className="su-front-pitch">
      <Tag className="su-front-pitch__value">{value}</Tag>
      {children && <p className="su-front-pitch__lede">{children}</p>}
      <div className="su-front-pitch__actions">{actions}</div>
      {note && <p className="su-front-pitch__note">{note}</p>}
    </div>
  )
}
