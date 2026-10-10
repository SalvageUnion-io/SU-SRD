/**
 * MediatorDisplay — the Mediator Dashboard's display (board M1;
 * docs/architecture/mediator-dashboard.md Q8, Q14): the tabs across the top,
 * the open tab on the left, and the propose dock on the right under every tab.
 *
 * P8a's tabs: **Opposition**, **Proposals**, **Tell the table**, **SRD**, and
 * **Log** set apart at the far end. (Tables, with private Mediator rolls, is
 * P8b.) They are component-lib's `Tabs`, so one tab stop and arrow keys
 * between tabs. Which tab is open is the caller's state, kept on the device.
 *
 * Presentational: the Dashboard builds each panel and the dock.
 */

import { Tab, TabList, TabPanel, Tabs, tokens } from 'component-lib'
import type { CSSProperties, ReactNode } from 'react'

const { borderWidth, color, space } = tokens

export type MediatorTab = 'opposition' | 'proposals' | 'tell' | 'srd' | 'log'

const PRIMARY: readonly { tab: MediatorTab; label: string }[] = [
  { tab: 'opposition', label: 'Opposition' },
  { tab: 'proposals', label: 'Proposals' },
  { tab: 'tell', label: 'Tell the table' },
  { tab: 'srd', label: 'SRD' },
]

const SECONDARY: readonly { tab: MediatorTab; label: string }[] = [{ tab: 'log', label: 'Log' }]

const ROOT: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
}

const LIST: CSSProperties = {
  flex: '0 0 auto',
  padding: `${space[8]} ${space[8]}`,
  borderBottom: `${borderWidth.chrome} solid ${color.ink}`,
}

const SPACER: CSSProperties = { flex: 1 }

/** The open tab beside the dock; each side scrolls inside itself. */
const SPLIT: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)',
  gridTemplateRows: 'minmax(0, 1fr)',
}

/** The phone column: the open tab over the dock, at their own heights. */
const STACKED: CSSProperties = { display: 'flex', flexDirection: 'column' }

const PANEL: CSSProperties = { position: 'relative', minHeight: 0, height: '100%' }

const DOCK: CSSProperties = {
  minHeight: 0,
  borderLeft: `${borderWidth.chrome} solid ${color.ink20}`,
}

const DOCK_STACKED: CSSProperties = { borderTop: `${borderWidth.chrome} solid ${color.ink20}` }

export function MediatorDisplay({
  tab,
  onTab,
  panels,
  dock,
  stacked = false,
}: {
  tab: MediatorTab
  onTab: (tab: MediatorTab) => void
  /** What each tab shows. Only the open one renders. */
  panels: Record<MediatorTab, ReactNode>
  /** The propose dock, shown under every tab. */
  dock: ReactNode
  stacked?: boolean
}) {
  return (
    <Tabs value={tab} onValueChange={onTab} style={stacked ? undefined : ROOT}>
      <TabList label="Display" style={LIST}>
        {PRIMARY.map((t) => (
          <Tab key={t.tab} value={t.tab}>
            {t.label}
          </Tab>
        ))}
        <span aria-hidden="true" style={SPACER} />
        {SECONDARY.map((t) => (
          <Tab key={t.tab} value={t.tab}>
            {t.label}
          </Tab>
        ))}
      </TabList>
      <div style={stacked ? STACKED : SPLIT}>
        <div style={stacked ? undefined : PANEL}>
          {[...PRIMARY, ...SECONDARY].map((t) => (
            <TabPanel key={t.tab} value={t.tab} style={stacked ? undefined : PANEL}>
              {panels[t.tab]}
            </TabPanel>
          ))}
        </div>
        <div style={stacked ? DOCK_STACKED : DOCK}>{dock}</div>
      </div>
    </Tabs>
  )
}
