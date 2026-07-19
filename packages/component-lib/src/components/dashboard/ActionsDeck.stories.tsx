import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { InstrumentStage } from '../../stories/_dashboardStage'
import { ActionsDeck, type DeckGroup } from './ActionsDeck'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Compositions/Dashboard/Actions Deck' }

const TABS = ['All', 'Turn', 'Short', 'Long', 'Free', 'React'] as const
const RANGES = ['Close', 'Medium', 'Long', 'Far'] as const

/**
 * Real SRD actions as the deck's rows — each drives a shortform
 * `ReferenceEntityCard` badge, exactly as the ITUN wrapper feeds it. The last
 * row is locked (dimmed in place) to exercise the reach/overheat overlay.
 */
function realGroups(): DeckGroup[] {
  const actions = SalvageUnionReference.Actions.all() as unknown as (SURefEntity & {
    id: string
    name: string
  })[]
  const chassisAction = actions.find((a) => /ram/i.test(a.name)) ?? actions[0]
  const rest = actions.filter((a) => a !== chassisAction).slice(0, 5)
  return [
    {
      label: 'Chassis',
      rows: chassisAction
        ? [
            {
              key: `act-${chassisAction.id}`,
              entity: chassisAction,
              name: chassisAction.name,
              locked: false,
            },
          ]
        : [],
    },
    {
      label: 'Systems',
      rows: rest.map((action, i) => ({
        key: `act-${action.id}`,
        entity: action,
        name: action.name,
        locked: i === rest.length - 1,
        lockTitle: i === rest.length - 1 ? 'Out of range / overheat' : undefined,
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
              hostTone: 'var(--color-mech)',
              groups,
              onOpen: () => {},
            }}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}
