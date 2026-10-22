/**
 * PlayPhone — Play's phone form (play.md §11, ADR-051 §10):
 * what `PlayFrame` hands `PlayCanvas` for below the canvas's floor.
 * Tabs, not a second layout:
 *
 *  - **The bar** (`PlayBar`'s phone form) across the top.
 *  - **Pinned**: the live vitals for the Situation (`PlayPinnedVitals`), then
 *    the Situation switch (the Mediator's Scene / Downtime), on every tab.
 *  - **The open tab's panel**, the only thing that scrolls: the page never
 *    does (`PlayCanvas`'s phone form fits the screen).
 *  - **The tabs** along the bottom, at thumb height, in a fixed order.
 *  - **Or the focus**: table mode's one screen (`PlayTableMode`) in place of
 *    the tabs, the panels kept mounted under it, so leaving it finds every
 *    tab as it was.
 *
 * Every panel stays mounted while closed (`keepMounted`, `hidden`), so a
 * half-typed Find, an open filter or a resolve in hand survives a switch, and
 * a panel's reads never restart. A form is a renderer (ADR-045 §1): what goes
 * in each panel is the canvas's own column components, and the screen's
 * shared state (the roll dispatch, the Post toggle) is read once by its caller.
 *
 * Controls keep their touch sizes: `.su-play-root--phone`, the host's scope, holds
 * every control to 44×44 (ruleset §4.6). The layout's states are
 * `.su-play-phone*` (`styles/play/phone.css`).
 */

import type { CSSProperties, ReactNode } from 'react'
import { capsLabel } from '../components/atoms/capsLabel'
import { Box, heatDangerFrom, Tab, TabList, TabPanel, Tabs, tokens } from '../components/index'
import { PlayVital } from './PlayVital'
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

/** The tabs under table mode: mounted, not drawn. */
const HIDDEN = { display: 'none' } satisfies CSSProperties

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

/**
 * A tab: a quarter of the row, its label whole (EDL E18, hard rule R29). A
 * label too long for its quarter widens its tab (no `minWidth: 0`) or wraps
 * between its words, never "…".
 */
const TAB = {
  border: 0,
  borderRadius: 0,
  flex: '1 1 0%',
  minHeight: '52px',
  padding: `0 ${tokens.space[4]}`,
  whiteSpace: 'normal',
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
  /** Table mode's screen: shown in place of the tabs while set. */
  focus?: ReactNode
}

export function PlayPhone<Value extends string>({
  bar,
  pinned,
  tabs,
  tab,
  onTab,
  panels,
  focus,
}: PlayPhoneProps<Value>) {
  const focused = focus !== undefined && focus !== null
  return (
    <div className="su-play-phone" style={ROOT}>
      {bar}
      <div style={PINNED}>{pinned}</div>
      {focused ? (
        <div style={PANEL}>
          <div style={PANEL_BODY}>{focus}</div>
        </div>
      ) : null}
      <Tabs value={tab} onValueChange={onTab} style={focused ? HIDDEN : TABS}>
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

/** One unit a line: its gauges share it. */
const UNITS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[6],
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const UNIT = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[4],
  minWidth: 0,
  padding: `${tokens.space[6]} ${tokens.space[8]}`,
} satisfies CSSProperties

const UNIT_NAME = {
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties
const UNIT_NAME_CAPS = capsLabel({ size: 'caption' })

const CELLS = {
  display: 'flex',
  gap: tokens.space[12],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

/** Each gauge an equal share of its unit's line. */
const CELL = { flex: '1 1 0%', minWidth: 0 } satisfies CSSProperties

/**
 * The live vitals pinned above every tab (`pinnedUnits`): one line per unit,
 * its name, then its vitals as the Units column draws them (`PlayVital`, the
 * compact `VitalGauge`: R7, Play's vitals are the sheet's gauge in a darker
 * skin, never a listing's Stat), each unit's HP and AP in a box in its tone.
 * A read-out: the − / +
 * are the Units tab's. Nothing in Downtime.
 */
export function PlayPinnedVitals({ units }: { units: readonly PinnedUnit[] }) {
  if (units.length === 0) return null
  return (
    <section aria-label="Pinned vitals" style={UNITS}>
      {units.map((unit) => (
        <Box key={unit.kind} frameColor={`var(--color-${unit.kind})`} body="flush" bodyStyle={UNIT}>
          <p className={UNIT_NAME_CAPS} style={UNIT_NAME}>
            {unit.name}
          </p>
          <ul aria-label={`${unit.name}’s vitals`} style={CELLS}>
            {unit.vitals.map((v) => (
              <li key={v.label} style={CELL}>
                <PlayVital
                  label={v.label}
                  value={v.value}
                  max={v.max}
                  tone={unit.kind}
                  danger={v.label === 'Heat' && v.max > 0 ? heatDangerFrom(v.max) : undefined}
                />
              </li>
            ))}
          </ul>
        </Box>
      ))}
    </section>
  )
}
