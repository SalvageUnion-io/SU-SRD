/*
 * Ported from packages/component-lib/src/components/shared/EntitySearcher.stories.tsx.
 *
 * The multi-select cell searches `crawler-bays` (14 entities) rather than the
 * story's `equipment` (82). Not a stylistic choice: entity cards gained a
 * responsive `srcSet` of remote candidates, so 82 cards fan out to several
 * hundred image requests and the capture browser dies outright ("Target page,
 * context or browser has been closed") — reproducibly, at every viewport tried.
 * A smaller real schema is a faithful use of the same picker; an uncapturable
 * cell is not.
 */
import { Button, EntitySearcher } from 'component-lib'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

/**
 * The shared "add an entity" body — search, Tech-Level and trait facets, and a
 * selection rail. It is a self-contained Card: title and close badge in the
 * header, search and filters in the sub-header band, the pool filling a padded
 * internally-scrolling body, and the Results box pinned floating bottom-right.
 *
 * This is the one layout — the catalog-choice modal and every sheet picker use
 * it inside a bare `ModalShell`.
 */
export function MultiSelect() {
  return (
    <div className="flex flex-col gap-3 bg-paper p-4">
      <Caption>multi-select over crawler bays — nothing chosen yet</Caption>
      <div className="mx-auto w-full max-w-5xl">
        <EntitySearcher
          schema="crawler-bays"
          selected={[]}
          onToggle={() => {}}
          chosenLabel="Chosen"
          title="Choose a Bay"
          onClose={() => {}}
        />
      </div>
    </div>
  )
}

/**
 * `mode="single"` — the exactly-one picker: a `radiogroup` pool, one Chosen
 * entry in the rail, and the picker's actions pinned beneath it.
 *
 * The story names two canonical single-select flows, Change Chassis and Change
 * Crawler Type, and renders the first. This uses the second, for the same
 * capture reason as the multi-select cell above: chassis carry the heaviest
 * artwork in the dataset, and that pool alone reproducibly kills the capture
 * browser. Crawler Type is an equally real use of the identical configuration.
 */
export function SingleSelect() {
  const first = nameToSlug(SalvageUnionReference.Crawlers.all()[0]?.name ?? '')
  return (
    <div className="flex flex-col gap-3 bg-paper p-4">
      <Caption>single-select over crawler types — one chosen, actions pinned</Caption>
      <div className="mx-auto w-full max-w-5xl">
        <EntitySearcher
          schema="crawlers"
          mode="single"
          selected={first ? [first] : []}
          onToggle={() => {}}
          idOf={(item: { name: string }) => nameToSlug(item.name)}
          facets={{ status: false }}
          chosenLabel="Chosen"
          title="Change Crawler Type"
          subtitle="Swapping type re-derives the crawler's stats."
          emptyMessage="No matching crawler types."
          onClose={() => {}}
          railActions={
            <>
              <Button variant="ghost" size="compact">
                Cancel
              </Button>
              <Button size="compact">Apply type</Button>
            </>
          }
        />
      </div>
    </div>
  )
}
