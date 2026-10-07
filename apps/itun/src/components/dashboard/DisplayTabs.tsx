/**
 * DisplayTabs — the display, as tabs (docs/architecture/dashboard-redesign.md
 * D5): Resolve, Reference, Tables and SRD first, then Log and Crew set apart
 * at the far end.
 *
 *   - **Resolve** — the action chosen from the deck (`ResolvePanel`);
 *   - **Reference** — the pilot's, mech's or crawler's reference card;
 *   - **Tables** — the roll-table roller;
 *   - **SRD** — the SRD explorer;
 *   - **Log** — the Game's rolls and the Mediator's alerts (`LogTab`);
 *   - **Crew** — each crewmate's vitals and status (`CrewTab`), with a ▲ on
 *     the tab while any of them needs looking at (D6).
 *
 * The tabs are component-lib's `Tabs`, so they carry the tabs keyboard model:
 * ArrowLeft/ArrowRight select the neighbouring tab, Home/End the ends, and Tab
 * moves into the open panel. Which tab is open is the caller's state, kept on
 * the device (D7): it is screen arrangement, not play state.
 *
 * Presentational: the Dashboard builds every panel and hands them in.
 */

import { Tab, TabList, TabPanel, Tabs } from 'component-lib'
import { color, space } from 'component-lib/design/tokens'
import type { CSSProperties, ReactNode } from 'react'

export type DisplayTab = 'resolve' | 'reference' | 'tables' | 'srd' | 'log' | 'crew'

const PRIMARY: readonly { tab: DisplayTab; label: string }[] = [
  { tab: 'resolve', label: 'Resolve' },
  { tab: 'reference', label: 'Reference' },
  { tab: 'tables', label: 'Tables' },
  { tab: 'srd', label: 'SRD' },
]

const SECONDARY: readonly { tab: DisplayTab; label: string }[] = [
  { tab: 'log', label: 'Log' },
  { tab: 'crew', label: 'Crew' },
]

const ROOT: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
}

const LIST: CSSProperties = { padding: `${space[8]} ${space[12]} 0`, flex: '0 0 auto' }

/** Pushes the secondary tabs to the far end of the row. */
const SPACER: CSSProperties = { flex: 1 }

/** The open panel fills the rest, and scrolls inside itself. */
const PANEL: CSSProperties = { position: 'relative', flex: 1, minHeight: 0 }

const ATTENTION: CSSProperties = { marginLeft: space[4], color: color.statusBad }

export function DisplayTabs({
  tab,
  onTab,
  panels,
  crewAttention = false,
}: {
  tab: DisplayTab
  onTab: (tab: DisplayTab) => void
  /** What each tab shows. Only the open one renders. */
  panels: Record<DisplayTab, ReactNode>
  /** Someone on the crew is ejected, injured, overheating or destroyed: ▲ on Crew. */
  crewAttention?: boolean
}) {
  return (
    <Tabs value={tab} onValueChange={onTab} style={ROOT}>
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
            {t.tab === 'crew' && crewAttention ? (
              <span role="img" aria-label="needs attention" style={ATTENTION}>
                ▲
              </span>
            ) : null}
          </Tab>
        ))}
      </TabList>
      {[...PRIMARY, ...SECONDARY].map((t) => (
        <TabPanel key={t.tab} value={t.tab} style={PANEL}>
          {panels[t.tab]}
        </TabPanel>
      ))}
    </Tabs>
  )
}
