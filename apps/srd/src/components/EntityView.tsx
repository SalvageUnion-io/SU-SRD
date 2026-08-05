/**
 * EntityView — the reference entity, rendered the lightest way it can be.
 * Port of `EntityView.astro`.
 *
 * Most SRD entities are documents: prose, stats and links, with nothing on the
 * card that needs a click handler. Those render to HTML at build time and ship
 * no JS at all — the real `ReferenceEntityCard`, not a simplified stand-in.
 *
 * A minority embed something genuinely interactive (a roll table's Roll button,
 * a disclosure, a nested-entity click target). Those keep the original island:
 * a `client="visible"` card gated on a browser-side preload, paired with
 * `StaticEntityContent` so crawlers and no-JS readers still get the text.
 *
 * The island cannot simply be dropped for them. `useGameData`'s server snapshot
 * is hardcoded `false` on purpose, so the card the browser renders on its first
 * pass is a skeleton, not the entity — server-rendering the island would put a
 * skeleton in the HTML and nothing else. Hence `ssr={false}` (and therefore no
 * children: the island component never enters the SSR module graph), with
 * `StaticEntityContent` as the SEO / no-JS path beside it.
 *
 * The ORM is already loaded: `../lib/gameData` runs `preload('all')` at module
 * scope, a superset of every `getSchemaPreloadList` answer, so the ORM lookups
 * `EntityCardStatic` and the `cardNeedsHydration` probe make resolve
 * synchronously. `preloadSchemas` is still computed here because it is a prop
 * of the CLIENT island, where the narrow list is the point.
 */

import { StaticEntityContent } from 'component-lib'
import type { SURefEntity, SURefObjectPattern } from 'salvageunion-reference'
import { cardNeedsHydration } from '../lib/cardNeedsHydration'
import { extractStaticEntitySummary } from '../lib/gameData'
import { patternStaticSummary } from '../lib/patternSummary'
import { getSchemaPreloadList } from '../lib/schemaPreloadDeps'
import { resolveTraitHref } from '../lib/staticLinks'
import { Island } from '../runtime/Island'
import { EntityCardStatic } from './EntityCardStatic'

type EntityViewProps = {
  item: SURefEntity
  schemaId: string
  /** Render one of `item`'s patterns (chassis only) rather than `item` itself. */
  pattern?: SURefObjectPattern
}

export function EntityView({ item, schemaId, pattern }: EntityViewProps) {
  if (!cardNeedsHydration(item, pattern)) {
    return <EntityCardStatic item={item} pattern={pattern} titleAs="h1" />
  }

  const staticSummary = pattern
    ? patternStaticSummary(item, pattern)
    : extractStaticEntitySummary(item)

  return (
    <>
      <Island
        name="ReferenceEntityIsland"
        client="visible"
        ssr={false}
        props={{
          item,
          pattern,
          titleAs: 'h1',
          preloadSchemas: getSchemaPreloadList(schemaId),
        }}
      />
      <StaticEntityContent summary={staticSummary} resolveTraitHref={resolveTraitHref} />
    </>
  )
}
