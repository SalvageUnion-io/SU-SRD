/**
 * DisplayTabs — the display's tabs (plan D5) carry the tabs keyboard model
 * (plan layer 6, audit UX-15): ArrowRight selects the next tab, across the gap
 * between the primary and the secondary tabs, and each tab names its panel.
 */

import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import type { DisplayTab } from '../DisplayTabs'
import { DisplayTabs } from '../DisplayTabs'

const PANELS: Record<DisplayTab, string> = {
  resolve: 'the resolve',
  reference: 'a reference card',
  tables: 'a roll table',
  srd: 'the SRD',
  log: 'the log',
  crew: 'the crew',
}

function Harness({ start = 'resolve' }: { start?: DisplayTab }) {
  const [tab, setTab] = useState<DisplayTab>(start)
  return <DisplayTabs tab={tab} onTab={setTab} panels={PANELS} />
}

async function pressOn(name: string, key: string) {
  const tab = screen.getByRole('tab', { name })
  await act(async () => {
    tab.focus()
  })
  await act(async () => {
    fireEvent.keyDown(tab, { key })
  })
}

describe('DisplayTabs', () => {
  test('six tabs in one labelled tablist, primary first, Log and Crew last', () => {
    render(<Harness />)
    expect(screen.getByRole('tablist', { name: 'Display' })).toBeTruthy()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Resolve',
      'Reference',
      'Tables',
      'SRD',
      'Log',
      'Crew',
    ])
    const open = screen.getByRole('tab', { name: 'Resolve' })
    const panel = screen.getByRole('tabpanel')
    expect(panel.textContent).toBe('the resolve')
    expect(open.getAttribute('aria-controls')).toBe(panel.id)
  })

  test('ArrowRight selects the next tab', async () => {
    render(<Harness />)
    await pressOn('Resolve', 'ArrowRight')
    expect(screen.getByRole('tab', { name: 'Reference' }).getAttribute('aria-selected')).toBe(
      'true'
    )
    expect(screen.getByRole('tabpanel').textContent).toBe('a reference card')
  })

  test('…across the gap to the secondary tabs, and End and Home reach the ends', async () => {
    render(<Harness start="srd" />)
    await pressOn('SRD', 'ArrowRight')
    expect(screen.getByRole('tabpanel').textContent).toBe('the log')
    await pressOn('Log', 'End')
    expect(screen.getByRole('tabpanel').textContent).toBe('the crew')
    await pressOn('Crew', 'Home')
    expect(screen.getByRole('tabpanel').textContent).toBe('the resolve')
  })

  test('a ▲ on Crew, named for a screen reader, only while someone needs attention', () => {
    const { rerender } = render(
      <DisplayTabs tab="resolve" onTab={() => undefined} panels={PANELS} />
    )
    expect(screen.queryByRole('img', { name: 'needs attention' })).toBeNull()

    rerender(<DisplayTabs tab="resolve" onTab={() => undefined} panels={PANELS} crewAttention />)
    expect(screen.getByRole('tab', { name: 'Crew needs attention' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'needs attention' }).textContent).toBe('▲')
  })
})
