/**
 * PhoneSheet, a phone's Live Sheet in Read, the
 * one frame all three kinds share (hard rule R11): the vitals block first
 * under the band (`PhoneVitals`), then one row of section tabs, each a 44px
 * target, then the open tab's panel. The first tab is what the unit does or
 * runs; who it is (About) is always last. From 40rem, and in Edit, each sheet
 * keeps its columns (`SheetColumns`).
 */

import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { Tab, TabList, TabPanel, Tabs, tokens } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'

/** The vitals, then the tabs: a list's gap apart, so both sit on the first screen. */
const ROOT = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

const TABS = { flexWrap: 'nowrap', gap: tokens.space[4] } satisfies CSSProperties
const TAB = {
  flex: '1 1 auto',
  minHeight: tokens.size.full,
  padding: `0 ${tokens.space[6]}`,
} satisfies CSSProperties
const PANEL = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  paddingTop: tokens.space[12],
} satisfies CSSProperties

/** A tab's count, quieter than its name. */
const COUNT = {
  fontWeight: tokens.weight.normal,
  marginLeft: tokens.space[4],
} satisfies CSSProperties

export type PhoneSheetTab = {
  value: string
  label: string
  /** `7/7`, `5/6`: what the tab holds, beside its name. */
  count?: string
  panel: ReactNode
}

export function PhoneSheet({
  name,
  vitals,
  tabs,
}: {
  /** The unit's name, for the tab row's label. */
  name: string
  vitals: ReactNode
  tabs: readonly PhoneSheetTab[]
}) {
  const [open, setOpen] = useState(tabs[0]?.value ?? '')
  return (
    <div style={ROOT} data-phone-sheet="">
      {vitals}
      <Tabs value={open} onValueChange={setOpen}>
        <TabList label={buildSheetCopy('unitSheet', { name })} style={TABS}>
          {tabs.map((tab) => (
            <Tab key={tab.value} value={tab.value} style={TAB}>
              {tab.label}
              {tab.count && <span style={COUNT}>{tab.count}</span>}
            </Tab>
          ))}
        </TabList>
        {tabs.map((tab) => (
          <TabPanel key={tab.value} value={tab.value} style={PANEL}>
            {tab.panel}
          </TabPanel>
        ))}
      </Tabs>
    </div>
  )
}
