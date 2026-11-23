/**
 * EntityView — the reference entity, rendered the lightest way it can be.
 *
 * Most SRD entities are documents: prose, stats and links, with nothing on the
 * card that needs a click handler. Those render to HTML at build time and ship
 * no JS at all — the real `ReferenceEntityCard`, not a simplified stand-in.
 *
 * A minority embed something genuinely interactive (a roll table's Table toggle,
 * a disclosure, a nested-entity click target). Those keep an island: a
 * `client="visible"` card that swaps in over its stand-in, the very same
 * `EntityCardStatic` drawn here, once its data is loaded. Crawlers, no-JS
 * readers and a reader waiting on the preload all get the whole card, and the
 * swap moves nothing (a summary stand-in once grew the page under the reader:
 * CLS 0.65 on /chassis/jackhammer/).
 *
 * The island cannot simply be dropped for them, nor hydrated: `useGameData`'s
 * server snapshot is hardcoded `false` on purpose, so the card the browser
 * renders on its first pass is empty, not the entity. Hence a swap
 * (`clientSwap`), never a hydration of the island itself.
 *
 * The ORM is already loaded: `../lib/gameData` runs `preload('all')` at module
 * scope, a superset of every `getSchemaPreloadList` answer, so the ORM lookups
 * `EntityCardStatic` and the `cardNeedsHydration` probe make resolve
 * synchronously. `preloadSchemas` is still computed here because it is a prop
 * of the CLIENT island, where the narrow list is the point.
 */

import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { EntityCardStatic } from '../components/EntityCardStatic'
import type { SideLinkList } from '../components/SideLinks'
import { cardNeedsHydration } from '../lib/cardNeedsHydration'
import { nameRefIndexWithout, nameRefsFor } from '../lib/nameRefIndex'
import { pageRefIndexFor } from '../lib/pageRefIndex'
import { getSchemaPreloadList } from '../lib/schemaPreloadDeps'
import { Island } from '../runtime/Island'

/**
 * A card's words as the server draws them: the prose its island resolves names
 * in, including what the card carries beyond its own record (a class's ability
 * tree, a chassis's patterns).
 */
function cardText(card: ReactElement): string {
  return renderToStaticMarkup(card)
    .replace(/<[^>]*>/g, '\n')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
}

type EntityViewProps = {
  item: RefEntity
  schemaId: string
  /** Render one of `item`'s patterns (chassis only) rather than `item` itself. */
  pattern?: RefObjectAnyPattern
  /** The tables it is rolled on, a compact box in the card's side column. */
  sideLinks?: SideLinkList
}

export function EntityView({ item, schemaId, pattern, sideLinks }: EntityViewProps) {
  // A guide's too: a loose "p. 235" beside a working link read as a leftover (RR-22).
  const pageRefs = pageRefIndexFor(item)
  // The server resolves names against the whole dataset (less the entity's
  // own name); the island carries just the names its card draws.
  const names = nameRefIndexWithout(item.id)
  if (!cardNeedsHydration(item, pattern)) {
    return (
      <EntityCardStatic
        item={item}
        pattern={pattern}
        pageRefs={pageRefs}
        nameRefs={names}
        sideLinks={sideLinks}
      />
    )
  }
  const nameRefs = nameRefsFor(item, [
    cardText(<EntityCardStatic item={item} pattern={pattern} pageRefs={pageRefs} />),
  ])

  // The stand-in is the card the island draws, with the same names linked.
  return (
    <Island
      name="ReferenceEntityIsland"
      client="visible"
      ssr
      props={{
        item,
        pattern,
        preloadSchemas: getSchemaPreloadList(schemaId),
        pageRefs,
        nameRefs,
        sideLinks,
      }}
    >
      <EntityCardStatic
        item={item}
        pattern={pattern}
        pageRefs={pageRefs}
        nameRefs={nameRefs}
        sideLinks={sideLinks}
      />
    </Island>
  )
}
