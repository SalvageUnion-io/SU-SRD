/* Ported from packages/component-lib/src/components/shared/EntitySearcher.stories.tsx. */
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
      <Caption>multi-select over equipment — nothing chosen yet</Caption>
      <div className="mx-auto w-full max-w-5xl">
        <EntitySearcher
          schema="equipment"
          selected={[]}
          onToggle={() => {}}
          chosenLabel="Chosen"
          title="Choose Equipment"
          onClose={() => {}}
        />
      </div>
    </div>
  )
}

/**
 * `mode="single"` — the exactly-one picker, over the largest entity in the data.
 * This is what the Change Chassis and Change Crawler Type modals render: a
 * `radiogroup` pool, one Chosen entry in the rail, and the picker's actions
 * pinned beneath it. `hide.patterns` drops a section the picker cannot act on.
 */
export function SingleSelect() {
  const first = nameToSlug(SalvageUnionReference.Chassis.all()[0]?.name ?? '')
  return (
    <div className="flex flex-col gap-3 bg-paper p-4">
      <Caption>single-select over chassis — one chosen, actions pinned</Caption>
      <div className="mx-auto w-full max-w-5xl">
        <EntitySearcher
          schema="chassis"
          mode="single"
          selected={first ? [first] : []}
          onToggle={() => {}}
          idOf={(item: { name: string }) => nameToSlug(item.name)}
          hide={{ patterns: true }}
          facets={{ status: false }}
          chosenLabel="Chosen"
          title="Change Chassis"
          subtitle="Swapping chassis clears the current loadout."
          emptyMessage="No matching chassis."
          onClose={() => {}}
          railActions={
            <>
              <Button variant="ghost" size="compact">
                Cancel
              </Button>
              <Button size="compact">Apply chassis</Button>
            </>
          }
        />
      </div>
    </div>
  )
}
