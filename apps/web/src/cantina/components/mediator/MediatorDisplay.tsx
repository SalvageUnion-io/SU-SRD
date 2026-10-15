/**
 * MediatorDisplay — the Mediator Dashboard's display (board M1;
 * docs/architecture/mediator-dashboard.md Q8, Q14): the tabs across the top,
 * the open tab on the left, and the propose dock on the right under every tab.
 *
 * The tabs: **Opposition**, **Proposals**, **Tell the table**, **Tables**,
 * **SRD**, and **Log** set apart at the far end (board M1). They
 * are src/ui's `Tabs`, so one tab stop and arrow keys between tabs, each
 * at the canvas's 48-unit control height. Which tab is open is the caller's
 * state, kept on the device.
 *
 * Presentational: the Dashboard builds each panel and the dock.
 */

import type { CSSProperties, ReactNode } from 'react'
import { Tab, TabList, TabPanel, Tabs, tokens } from '../../../ui/index'

const { borderWidth, color, space } = tokens

export type MediatorTab = 'opposition' | 'proposals' | 'tell' | 'tables' | 'srd' | 'log'

const PRIMARY: readonly { tab: MediatorTab; label: string }[] = [
  { tab: 'opposition', label: 'Opposition' },
  { tab: 'proposals', label: 'Proposals' },
  { tab: 'tell', label: 'Tell the table' },
  { tab: 'tables', label: 'Tables' },
  { tab: 'srd', label: 'SRD' },
]

const SECONDARY: readonly { tab: MediatorTab; label: string }[] = [{ tab: 'log', label: 'Log' }]

const ROOT = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
} satisfies CSSProperties

const LIST = {
  flex: '0 0 auto',
  padding: `${space[8]} ${space[8]}`,
  borderBottom: `${borderWidth.chrome} solid ${color.ink}`,
} satisfies CSSProperties

const SPACER = { flex: 1 } satisfies CSSProperties

/** The canvas's control height (48 design units), as Begin Downtime has. */
const TAB = { minHeight: '48px' } satisfies CSSProperties

/** The open tab beside the dock; each side scrolls inside itself. */
const SPLIT = {
  flex: 1,
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)',
  gridTemplateRows: 'minmax(0, 1fr)',
} satisfies CSSProperties

/** The phone column: the open tab over the dock, at their own heights. */
const STACKED = { display: 'flex', flexDirection: 'column' } satisfies CSSProperties

const PANEL = { position: 'relative', minHeight: 0, height: '100%' } satisfies CSSProperties

const DOCK = {
  minHeight: 0,
  borderLeft: `${borderWidth.chrome} solid ${color.ink20}`,
} satisfies CSSProperties

const DOCK_STACKED = {
  borderTop: `${borderWidth.chrome} solid ${color.ink20}`,
} satisfies CSSProperties

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
          <Tab key={t.tab} value={t.tab} style={TAB}>
            {t.label}
          </Tab>
        ))}
        <span aria-hidden="true" style={SPACER} />
        {SECONDARY.map((t) => (
          <Tab key={t.tab} value={t.tab} style={TAB}>
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
