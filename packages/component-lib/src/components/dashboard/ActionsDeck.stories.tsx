import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { InstrumentStage } from '../../stories/_dashboardStage'
import { ActionsDeck, type DeckGroup } from './ActionsDeck'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Dashboard/ActionsDeck' }

const TABS = ['All', 'Turn', 'Short', 'Long', 'Free', 'React'] as const
const RANGES = ['Close', 'Medium', 'Long', 'Far'] as const

/** Real SRD systems as the deck's action rows (the ITUN wrapper builds these). */
function realGroups(): DeckGroup[] {
  const systems = SalvageUnionReference.Systems.all().slice(0, 5)
  return [
    {
      label: 'Chassis',
      rows: [
        { key: 'chassis-ram', stamp: 'CHS', name: 'Ram', meta: ['Turn', 'Close'], locked: false },
      ],
    },
    {
      label: 'Systems',
      rows: systems.map((sys, i) => ({
        key: `sys-${sys.id}`,
        stamp: 'SYS',
        name: sys.name,
        meta: i % 2 === 0 ? ['Turn'] : ['Free'],
        costLabel: i % 2 === 0 ? `${(i % 3) + 1} EP` : undefined,
        locked: i === 4,
        lockTitle: i === 4 ? 'Out of range / overheat' : undefined,
      })),
    },
  ]
}

/**
 * The Actions deck list view: timing tabs, group/range tools, source tags, and
 * grouped action rows (out-of-range rows dim in place). Real SRD systems drive
 * the rows; the resolve panel (not shown) reuses ReferenceEntityDisplay.
 */
export const Default: Story = () => {
  const [tab, setTab] = useState<string>('All')
  const [range, setRange] = useState<string>('Close')
  const groups = realGroups()
  return (
    <div className="flex flex-col gap-4">
      <Caption>Actions deck (list view) — filter tabs, range/reach, grouped rows.</Caption>
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
              groupingLabel: 'Source',
              groupingTitle: 'Group by timing',
              onToggleGrouping: () => {},
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
              groups,
              onOpen: () => {},
            }}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}
