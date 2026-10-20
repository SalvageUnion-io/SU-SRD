import { useContext } from 'react'
import type { RefMetaEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { entityRef, isBioTitanPattern } from 'salvageunion-reference'
import { useEntitySurface } from '../../entity/entitySurfaceContext'
import { LinkSurface } from '../../entity/modes/link'
import { useLinkTarget } from '../../entity/modes/linkTarget'
import type { EntityLinkAttrs } from '../../entity/types'
import { InsidePickContext } from './insidePick'

const LINK = { kind: 'link' } as const
/** In a Peek: the plate's one link (`data-peek-open`, R33), never a tab stop. */
const IN_PEEK = { 'data-peek-open': '', tabIndex: -1 } as EntityLinkAttrs

/**
 * A card's NAME as the link to its own Page (owner's call, 2026-10-20: "linked
 * names"), as a Mini's name is (`.su-entity-mini__link`): a nested card's,
 * and the Peek's, so an entity met inside another opens where it lives without
 * a chip or a ⋯ of its own. A route is an `<a href>`, the app's Page opener a
 * button (`LinkSurface`); with neither, or inside a pick (the pick is the one
 * control), the name stays text.
 *
 * A pattern's card (`pattern`) names the pattern's own Page, where the
 * surface has routes (the SRD); the app's patterns have no Page, so there it
 * stays text rather than opening the chassis's.
 *
 * In a Peek (`inPeek`) it is the plate's one link (R33, `data-peek-open`), out
 * of the tab order: focus never moves into a Peek, and the trigger that opened
 * it is the keyboard's link to the same Page.
 */
export function CardTitleLink({
  entity,
  title,
  inPeek,
  pattern,
}: {
  entity: RefMetaEntity
  title: string
  inPeek: boolean
  /** The pattern view's pattern: the name links to its Page, not its host's. */
  pattern?: RefObjectAnyPattern
}) {
  const { hrefFor } = useEntitySurface()
  const ref = entityRef(entity)
  const patternHref = pattern
    ? hrefFor({
        ...ref,
        schemaName: isBioTitanPattern(pattern) ? 'bio-titans' : 'chassis',
        pattern: pattern.name,
      })
    : undefined
  const mode = pattern ? { kind: 'link' as const, href: patternHref } : LINK
  const target = useLinkTarget(mode, ref)
  const inPick = useContext(InsidePickContext)
  if (inPick || (pattern && !patternHref) || (!target.href && !target.onOpen)) return title
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
