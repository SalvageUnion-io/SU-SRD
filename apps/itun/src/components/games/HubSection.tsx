/**
 * HubSection — one section of a Game's own page (board M2, issue 1278): the
 * solid section stamp of the refresh, a dashed rule to a count or a hint at
 * the far end ("CREW & SEATS ┄┄┄ 5 of 6 seats"), then its content.
 *
 * The page sets them in two columns (`HUB_COLUMNS`) that become one on a
 * phone without a media query: `min(100%, 26rem)` is what keeps a 390px
 * screen from scrolling sideways.
 */

import { Slab, tokens } from 'component-lib'
import type { CSSProperties, ReactNode } from 'react'

const { space } = tokens

const SECTION: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  minWidth: 0,
}

type HubSectionProps = {
  /** The heading's id, which names the section (`aria-labelledby`). */
  id: string
  title: string
  /** A count or a hint at the end of the rule. */
  aside?: ReactNode
  children: ReactNode
}

export function HubSection({ id, title, aside, children }: HubSectionProps) {
  return (
    <section aria-labelledby={id} style={SECTION}>
      <Slab variant="solid" as="h2" id={id} label={title} count={aside} />
      {children}
    </section>
  )
}
