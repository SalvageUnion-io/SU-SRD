/**
 * PlayPhone — Play's phone form (play.md §11, ADR-051 §10, wireframe phone):
 * what `PlayFrame` hands `PlayCanvas` for below the canvas's floor.
 * Tabs, not a second layout:
 *
 *  - **The bar** (`PlayBar`'s phone form) across the top.
 *  - **Pinned**: the live vitals for the Situation (`PlayPinnedVitals`), then
 *    the Situation switch (the Mediator's Scene / Downtime), on every tab.
 *  - **The open tab's panel**, the only thing that scrolls: the page never
 *    does (`PlayCanvas`'s phone form fits the screen).
 *  - **The tabs** along the bottom, at thumb height, in a fixed order.
 *
 * Every panel stays mounted while closed (`keepMounted`, `hidden`), so a
 * half-typed Find, an open filter or a resolve in hand survives a switch, and
 * a panel's reads never restart. A form is a renderer (ADR-045 §1): what goes
 * in each panel is the canvas's own column components, and the screen's
 * shared state (the roll dispatch, the Post toggle) is read once by its caller.
 *
 * Controls keep their touch sizes: `.su-dash-phone`, the host's scope, holds
 * every control to 44×44 (ruleset §4.6). The layout's states are
 * `.su-play-phone*` (`styles/cantina/play/phone.css`).
 */

import type { CSSProperties, ReactNode } from 'react'
import { Stat, Tab, TabList, TabPanel, Tabs, tokens } from '../index'
import type { PhoneTab, PinnedUnit } from './playPhone.model'

const ROOT = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  width: '100%',
} satisfies CSSProperties

const PINNED = {
  borderBottom: `${tokens.borderWidth.hairline} solid var(--color-ink-30)`,
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  gap: tokens.space[6],
  padding: `${tokens.space[6]} ${tokens.space[8]}`,
} satisfies CSSProperties

const TABS = {
  display: 'flex',
  flex: '1 1 0%',
  flexDirection: 'column',
  minHeight: 0,
} satisfies CSSProperties

/** A panel: the only scroller on the screen. No `display` here: `hidden` must win. */
const PANEL = {
  background: 'var(--color-paper)',
  flex: '1 1 0%',
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
} satisfies CSSProperties

/** What a panel lists, as a column lists it: level-1 boxes on an even gap. */
const PANEL_BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  padding: tokens.space[8],
} satisfies CSSProperties

/** The tab row at the foot: the tabs share it, each a thumb's width. */
const TAB_LIST = {
  borderTop: `${tokens.borderWidth.chrome} solid var(--color-ink)`,
  flexShrink: 0,
  flexWrap: 'nowrap',
  gap: 0,
} satisfies CSSProperties

const TAB = {
  border: 0,
  borderRadius: 0,
  flex: '1 1 0%',
  minHeight: '52px',
  minWidth: 0,
  padding: `0 ${tokens.space[4]}`,
} satisfies CSSProperties

type PlayPhoneProps<Value extends string> = {
  /** The Play bar, in its phone form. */
  bar: ReactNode
  /** Pinned above every tab: the vitals and the Situation switch. */
  pinned: ReactNode
  /** The tab row, in order. */
  tabs: readonly PhoneTab<Value>[]
  /** The open tab. */
  tab: Value
  onTab: (tab: Value) => void
  /** Each tab's panel: the canvas's column components. */
  panels: Record<Value, ReactNode>
}

export function PlayPhone<Value extends string>({
  bar,
  pinned,
  tabs,
  tab,
  onTab,
  panels,
}: PlayPhoneProps<Value>) {
  return (
    <div className="su-play-phone" style={ROOT}>
      {bar}
      <div style={PINNED}>{pinned}</div>
      <Tabs value={tab} onValueChange={onTab} style={TABS}>
        {tabs.map((t) => (
          <TabPanel key={t.value} value={t.value} keepMounted style={PANEL}>
            <div style={PANEL_BODY}>{panels[t.value]}</div>
          </TabPanel>
        ))}
        <TabList label="Play" style={TAB_LIST}>
          {tabs.map((t) => (
            <Tab key={t.value} value={t.value} style={TAB}>
              {t.label}
            </Tab>
          ))}
        </TabList>
      </Tabs>
    </div>
  )
}

const UNITS = {
  display: 'grid',
  gap: tokens.space[6],
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const UNIT = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[4],
  minWidth: 0,
} satisfies CSSProperties

const UNIT_NAME = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.caption,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsTight,
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const CELLS = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[4],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

/**
 * The live vitals pinned above every tab (`pinnedUnits`): one group per unit,
 * its name, then a `label | value/max` cell per vital (ruleset §3.7, the
 * listing's Stat, as ADR-045's pinned row drew them). A read-out: the − / +
 * are the Units tab's. Nothing in Downtime.
 */
export function PlayPinnedVitals({ units }: { units: readonly PinnedUnit[] }) {
  if (units.length === 0) return null
  return (
    <section aria-label="Pinned vitals" style={UNITS}>
      {units.map((unit) => (
        <div key={unit.kind} style={UNIT}>
          <p style={UNIT_NAME}>{unit.name}</p>
          <ul aria-label={`${unit.name}’s vitals`} style={CELLS}>
            {unit.vitals.map((v) => (
              <li key={v.label}>
                <Stat
                  orientation="horizontal"
                  size="compact"
                  label={v.label}
                  value={v.value}
                  max={v.max}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
