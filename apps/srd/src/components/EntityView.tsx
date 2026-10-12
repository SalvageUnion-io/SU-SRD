/**
 * EntityView — the reference entity, rendered the lightest way it can be.
 *
 * Most SRD entities are documents: prose, stats and links, with nothing on the
 * card that needs a click handler. Those render to HTML at build time and ship
 * no JS at all — the real `ReferenceEntityCard`, not a simplified stand-in.
 *
 * A minority embed something genuinely interactive (a roll table's Table toggle,
 * a disclosure, a nested-entity click target). Those keep an island:
 * a `client="visible"` card gated on a browser-side preload, paired with
 * `StaticEntityContent` so crawlers, no-JS readers and a reader waiting on the
 * preload all get the text.
 *
 * The island cannot simply be dropped for them. `useGameData`'s server snapshot
 * is hardcoded `false` on purpose, so the card the browser renders on its first
 * pass is empty, not the entity — server-rendering the island would put
 * nothing in the HTML. Hence `ssr={false}` (and therefore no
 * children: the island component never enters the SSR module graph), with
 * `StaticEntityContent` as the SEO / no-JS path beside it.
 *
 * The ORM is already loaded: `../lib/gameData` runs `preload('all')` at module
 * scope, a superset of every `getSchemaPreloadList` answer, so the ORM lookups
 * `EntityCardStatic` and the `cardNeedsHydration` probe make resolve
 * synchronously. `preloadSchemas` is still computed here because it is a prop
 * of the CLIENT island, where the narrow list is the point.
 */

import type { SURefEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import { getEntitySlug, schemaHasArt } from 'salvageunion-reference'
import { cardNeedsHydration } from '../lib/cardNeedsHydration'
import { itemHref } from '../lib/entityHref'
import { extractStaticEntitySummary } from '../lib/gameData'
import { pageRefIndexFor } from '../lib/pageRefIndex'
import { patternStaticSummary } from '../lib/patternSummary'
import { getSchemaPreloadList } from '../lib/schemaPreloadDeps'
import { Island } from '../runtime/Island'
import { EntityCardStatic } from './EntityCardStatic'
import { StaticEntityContent } from './StaticEntityContent'

type EntityViewProps = {
  item: SURefEntity
  schemaId: string
  /** Render one of `item`'s patterns (chassis only) rather than `item` itself. */
  pattern?: SURefObjectAnyPattern
}

export function EntityView({ item, schemaId, pattern }: EntityViewProps) {
  const artSlot = schemaHasArt(schemaId)
  const pageRefs = pageRefIndexFor(item)
  if (!cardNeedsHydration(item, pattern)) {
    return <EntityCardStatic item={item} pattern={pattern} artSlot={artSlot} pageRefs={pageRefs} />
  }

  // The fallback draws its references as Mentions, so it keeps their markup.
  const staticSummary = pattern
    ? patternStaticSummary(item, pattern, { keepReferences: true })
    : extractStaticEntitySummary(item, { keepReferences: true })

  return (
    <>
      <Island
        name="ReferenceEntityIsland"
        client="visible"
        ssr={false}
        props={{
          item,
          pattern,
          preloadSchemas: getSchemaPreloadList(schemaId),
          artSlot,
          pageRefs,
        }}
      />
      <StaticEntityContent
        summary={staticSummary}
        parent={
          pattern
            ? {
                label: 'Pattern of',
                name: item.name,
                href: itemHref(schemaId, getEntitySlug(item)),
              }
            : undefined
        }
      />
    </>
  )
}
