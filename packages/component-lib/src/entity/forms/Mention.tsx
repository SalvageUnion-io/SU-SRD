import type { ReactNode } from 'react'
import type { EntityRef } from 'salvageunion-reference'
import { InlineRef } from '../../components/atoms/InlineRef'
import { useEntitySurface } from '../entitySurfaceContext'
import { useInsidePeek, usePeekAttrs } from '../peekContext'

export type MentionProps = {
  /**
   * The entity the prose names. `undefined` for a name that resolves to
   * nothing: the word renders inert, with no Peek.
   */
  entityRef: EntityRef | undefined
  /** The words as the prose prints them ("Burn (X)"). */
  children: ReactNode
}

/**
 * MENTION (entity display language, E4): an entity named in prose. The name in
 * the prose's own type (`InlineRef`), the Page on click and the Peek on hover,
 * focus or long-press.
 *
 * Where it goes comes from the SURFACE: its route (`hrefFor`, the SRD) makes it
 * a link; else the Page opener (`openPage`, ITUN) makes it a button; else it is
 * an inert mark that still Peeks. A synthetic or unresolvable ref, and any
 * Mention inside a Peek (E16), is inert and Peeks nothing.
 *
 * The Peek itself is the page's one `PeekHost`: the Mention only carries its
 * address (`data-peek`), so it renders the same on the server.
 */
export function Mention({ entityRef, children }: MentionProps) {
  const surface = useEntitySurface()
  const insidePeek = useInsidePeek()
  const peek = usePeekAttrs(entityRef)
  if (!entityRef || entityRef.synthetic || insidePeek) return <InlineRef>{children}</InlineRef>
  const href = surface.hrefFor(entityRef)
  if (href) {
    return (
      <InlineRef href={href} {...peek}>
        {children}
      </InlineRef>
    )
  }
  const { openPage } = surface
  if (openPage) {
    return (
      <InlineRef onOpen={() => openPage(entityRef)} {...peek}>
        {children}
      </InlineRef>
    )
  }
  return <InlineRef {...peek}>{children}</InlineRef>
}
