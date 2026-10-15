/**
 * HubSection — one section of a Game's own page (board M2): the
 * solid section stamp of the refresh, a dashed rule to a count or a hint at
 * the far end ("CREW & SEATS ┄┄┄ SEATS | 5/6"), then its content.
 *
 * The page sets them in two columns (`HUB_COLUMNS`) that become one on a
 * phone without a media query: `min(100%, 26rem)` is what keeps a 390px
 * screen from scrolling sideways.
 */

import type { CSSProperties, ReactNode } from 'react'
import type { SlabCount } from '../../../ui/index'
import { Slab, tokens } from '../../../ui/index'

const { space } = tokens

const SECTION = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  minWidth: 0,
} satisfies CSSProperties

type HubSectionProps = {
  /** The heading's id, which names the section (`aria-labelledby`). */
  id: string
  title: string
  /** A hint at the end of the rule, or a value count as its chip (`SEATS | 5/6`). */
  aside?: ReactNode | SlabCount
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
