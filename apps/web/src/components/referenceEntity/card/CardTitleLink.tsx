import { useContext } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { entityRef } from 'salvageunion-reference'
import { LinkSurface } from '../../entity/modes/link'
import { useLinkTarget } from '../../entity/modes/linkTarget'
import type { EntityLinkAttrs } from '../../entity/types'
import { InsidePickContext } from './insidePick'

const LINK = { kind: 'link' } as const
/** In a Peek: the plate's one link (`data-peek-open`, R33), never a tab stop. */
const IN_PEEK = { 'data-peek-open': '', tabIndex: -1 } as EntityLinkAttrs

/**
 * A card's NAME as the link to its own Page (owner's call, 2026-10-20: "linked
 * names"), as a Token's name is (`.su-entity-token__link`): a nested card's,
 * and the Peek's, so an entity met inside another opens where it lives without
 * a chip or a ⋯ of its own. A route is an `<a href>`, the app's Page opener a
 * button (`LinkSurface`); with neither, or inside a pick (the pick is the one
 * control), the name stays text.
 *
 * In a Peek (`inPeek`) it is the plate's one link (R33, `data-peek-open`), out
 * of the tab order: focus never moves into a Peek, and the trigger that opened
 * it is the keyboard's link to the same Page.
 */
export function CardTitleLink({
  entity,
  title,
  inPeek,
}: {
  entity: RefMetaEntity
  title: string
  inPeek: boolean
}) {
  const target = useLinkTarget(LINK, entityRef(entity))
  const inPick = useContext(InsidePickContext)
  if (inPick || (!target.href && !target.onOpen)) return title
  return (
    <LinkSurface
      target={target}
      label={`Open ${title}`}
      attrs={inPeek ? IN_PEEK : undefined}
      className="su-card-title-link"
    >
      {title}
    </LinkSurface>
  )
}
