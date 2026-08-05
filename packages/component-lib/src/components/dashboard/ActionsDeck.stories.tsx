import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { InstrumentStage } from '../../stories/_dashboardStage'
import { Caption } from '../../stories/_harness'
import type { DeckRow } from './ActionsDeck'
import { ActionsDeck } from './ActionsDeck'

export default { title: 'Compositions/Dashboard/Actions Deck' }

const TABS = ['All', 'Turn', 'Short', 'Long', 'Free', 'React'] as const
const RANGES = ['Close', 'Medium', 'Long', 'Far'] as const

/**
 * Real SRD actions as the deck's tiles — each drives a catalog-extent
 * `ReferenceEntityCard`, exactly as the ITUN wrapper feeds it, in ONE flat grid
 * (no source headings). The last tile is locked (dimmed in place) to exercise
 * the reach/overheat overlay.
 */
function realRows(): DeckRow[] {
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
 * one masonry grid of catalog action tiles (out-of-range tiles dim in place).
 * Real SRD actions drive them; the resolve panel (not shown) reuses
 * ReferenceEntityCard.
 */
export const Default: Story = () => {
  const [tab, setTab] = useState<string>('All')
  const [range, setRange] = useState<string>('Close')
  const rows = realRows()
  return (
    <div className="flex flex-col gap-4">
      <Caption>Actions deck (list view) — filter tabs, range/reach, masonry tile grid.</Caption>
      <InstrumentStage width={560}>
        <div
          className="pc-display-light"
          style={{ height: 520, borderRadius: 'var(--radius-panel)' }}
        >
          <ActionsDeck
            view={{
              kind: 'list',
              tabs: TABS,
              activeTab: tab,
              onTab: setTab,
              rangeBands: RANGES,
              activeRange: range,
              onRange: setRange,
              reachText: '5 / 6 in reach',
              sources: [
                { label: 'Iron Mongrel', stamp: 'CHS' },
                { label: 'Plasma Cannon', stamp: 'SYS' },
              ],
              sourceFilter: null,
              onSourceFilter: () => {},
              familyClass: 'pc-deck-fam-mech',
              hostTone: 'var(--color-mech)',
              rows,
              onOpen: () => {},
            }}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}
