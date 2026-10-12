import type { CSSProperties, ReactNode } from 'react'
import { space } from '../../../design/tokens'
import { Facts } from '../../../entity/parts/Facts'
import { Tags } from '../../../entity/parts/Tags'
import type { CardSize } from '../../containers/displayMode'
import type { SplitFacets } from './facetSplit'

/** Padding by size: the row sits a few pixels above the body (board E1). */
const PAD: Record<CardSize, string> = {
  large: `${space[8]} ${space[14]} 0`,
  medium: `${space[6]} ${space[10]} 0`,
  small: `${space[4]} ${space[8]} 0`,
}

/**
 * The FACETS ROW of a card or a page (E17): the facet Stats, then the trait
 * Tags, led by a stamp the context adds ("Suggested"). It stands where the
 * italic "//" line stood: under a card's header, under an action band, and at
 * the head of a page's prose column, where the Tags lead (`flush="block"`).
 * The action type is not here: it is a stamp in the head.
 */
export function CardFacets({
  facets,
  leading,
  size,
  flush = false,
  linkable = false,
}: {
  facets: SplitFacets
  leading?: ReactNode
  size: CardSize
  /** No padding of its own: a page's prose column sets the edge. */
  flush?: boolean
  /** Tags may link (a page, not inside a clickable card). */
  linkable?: boolean
}) {
  if (!leading && facets.facts.length === 0 && facets.tags.length === 0) return null
  const row: CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: space[4],
    ...(flush ? {} : { padding: PAD[size] }),
  }
  return (
    <div style={row}>
      {leading}
      <Facts cells={facets.facts} />
      <Tags tags={facets.tags} linkable={linkable} />
    </div>
  )
}
