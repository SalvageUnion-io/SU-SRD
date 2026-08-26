/* Ported from packages/component-lib/src/components/dashboard/ActionsDeck.stories.tsx. */
import { ActionsDeck } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption, InstrumentStage } from '../preview-lib/harness'

const TABS = ['All', 'Turn', 'Short', 'Long', 'Free', 'React']
const RANGES = ['Close', 'Medium', 'Long', 'Far']

/**
 * Real SRD actions as the deck's tiles — each drives a catalog-extent
 * `ReferenceEntityCard`, exactly as the ITUN wrapper feeds it, in ONE flat grid
 * with no source headings. The last tile is locked, which dims it in place to
 * exercise the reach/overheat overlay.
 */
function realRows() {
  const actions = SalvageUnionReference.Actions.all().slice(0, 6)
  return actions.map((action, i) => ({
    key: `act-${action.id}`,
    entity: action,
    name: action.name,
    locked: i === actions.length - 1,
    lockTitle: i === actions.length - 1 ? 'Out of range / overheat' : undefined,
  }))
}

/**
 * The Actions deck list view: timing tabs, range/reach tools, source tags, and
 * one masonry grid of catalog action tiles. The resolve panel (not shown) reuses
 * `ReferenceEntityCard`.
 */
export function ListView() {
  return (
    <div className="flex flex-col gap-4">
      <Caption>actions deck — filter tabs, range/reach, masonry tile grid</Caption>
      <InstrumentStage width={560}>
        <div
          className="pc-display-light"
          style={{ height: 520, borderRadius: 'var(--radius-panel)' }}
        >
          <ActionsDeck
            view={{
              kind: 'list',
              tabs: TABS,
              activeTab: 'All',
              onTab: () => {},
              rangeBands: RANGES,
              activeRange: 'Close',
              onRange: () => {},
              reachText: '5 / 6 in reach',
              sources: [
                { label: 'Iron Mongrel', stamp: 'CHS' },
                { label: 'Plasma Cannon', stamp: 'SYS' },
              ],
              sourceFilter: null,
              onSourceFilter: () => {},
              familyClass: 'pc-deck-fam-mech',
              hostTone: 'var(--color-mech)',
              rows: realRows(),
              onOpen: () => {},
            }}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}

/** A timing tab engaged — the deck filtered to Turn actions. */
export function FilteredTab() {
  return (
    <div className="flex flex-col gap-4">
      <Caption>a timing tab engaged, and a range band selected</Caption>
      <InstrumentStage width={560}>
        <div
          className="pc-display-light"
          style={{ height: 520, borderRadius: 'var(--radius-panel)' }}
        >
          <ActionsDeck
            view={{
              kind: 'list',
              tabs: TABS,
              activeTab: 'Turn',
              onTab: () => {},
              rangeBands: RANGES,
              activeRange: 'Medium',
              onRange: () => {},
              reachText: '3 / 6 in reach',
              sources: [{ label: 'Iron Mongrel', stamp: 'CHS' }],
              sourceFilter: 'Iron Mongrel',
              onSourceFilter: () => {},
              familyClass: 'pc-deck-fam-mech',
              hostTone: 'var(--color-mech)',
              rows: realRows().slice(0, 4),
              onOpen: () => {},
            }}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}
