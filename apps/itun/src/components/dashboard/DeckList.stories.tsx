import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { InstrumentStage } from './_dashboardStage'
import type { DeckRow } from './DeckList'
import { DeckList } from './DeckList'

export default { title: 'Compositions/Dashboard/Deck List' }

const TABS = ['All', 'Turn', 'Short', 'Long', 'Free', 'React'] as const
const RANGES = ['Close', 'Medium', 'Long', 'Far'] as const

const STACK: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 }

const FRAME: CSSProperties = { height: 520, borderRadius: 'var(--radius-panel)' }

/**
 * Real SRD actions as the deck's tiles — each drives a catalog-extent
 * `ReferenceEntityCard`, exactly as `useActionsDeck` feeds it, in ONE flat grid
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
 * The deck beside the display: timing, range and source filters (toggle
 * buttons, each `aria-pressed`) over one masonry grid of catalog action
 * tiles. Opening one resolves it in the display's Resolve tab.
 */
export const Default = () => {
  const [tab, setTab] = useState<string>('All')
  const [range, setRange] = useState<string>('Close')
  const [source, setSource] = useState<string | null>(null)
  return (
    <div style={STACK}>
      <Caption>Deck list — timing, range and source filters over the tile grid.</Caption>
      <InstrumentStage width={560}>
        <div className="pc-display-light" style={FRAME}>
          <DeckList
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
              sourceFilter: source,
              onSourceFilter: setSource,
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
