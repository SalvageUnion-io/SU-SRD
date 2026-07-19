/**
 * Tests for DisplayView — the Dashboard's main display. Verifies each dial-focus
 * kind renders without throwing and reuses the real reference components:
 * a resolvable chassis → a ReferenceEntityDisplay card; Tables → a RollTable;
 * unresolvable slugs → a graceful note (never a crash).
 *
 * Reference content needs the ORM, so preload('all') runs once. A real chassis
 * slug is picked from the loaded set so the card path is genuinely exercised.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { EntityHrefProvider } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'

import type { Crawler } from '../../../lib/schemas/crawler'
import type { Mech } from '../../../lib/schemas/mech'
import { DisplayView } from '../DisplayView'
import type { DialItem } from '../dialItems'

let chassisSlug = 'iron-mongrel'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
  const first = SalvageUnionReference.Chassis.all()[0] as { id?: string } | undefined
  if (first?.id) chassisSlug = first.id
})

function renderDV(focus: DialItem | undefined, mechChassis = chassisSlug) {
  const mech = { id: 'm1', name: 'Rig', chassisRef: mechChassis } as unknown as Mech
  const crawler = { id: 'c1', name: 'Hauler', techLevel: '3' } as unknown as Crawler
  return render(
    <EntityHrefProvider value={() => undefined}>
      <DisplayView focus={focus} mech={mech} pilot={null} crawler={crawler} />
    </EntityHrefProvider>
  )
}

describe('DisplayView', () => {
  test('mech focus → a resolvable chassis renders a reference card', () => {
    const focus: DialItem = {
      key: 'mech:m1',
      kind: 'mech',
      statless: false,
      label: 'Mech · Rig',
      tone: 'mech',
      gauges: [],
    }
    const { container } = renderDV(focus)
    // The reference card renders real content, not the fallback note.
    expect(container.querySelector('.pc-display-note')).toBeNull()
    expect(container.querySelector('.pc-display-scroll')).toBeTruthy()
  })

  test('mech focus → an unresolvable chassis falls back to a note, no throw', () => {
    const focus: DialItem = {
      key: 'mech:m1',
      kind: 'mech',
      statless: false,
      label: 'Mech · Rig',
      tone: 'mech',
      gauges: [],
    }
    const { container } = renderDV(focus, 'definitely-not-a-chassis')
    expect(container.querySelector('.pc-entity-fallback')?.textContent).toContain(
      'not in the reference set'
    )
  })

  test('mech focus → foot carries a "Full mech sheet" link (D5)', () => {
    const focus: DialItem = {
      key: 'mech:m1',
      kind: 'mech',
      statless: false,
      label: 'Mech · Rig',
      tone: 'mech',
      gauges: [],
    }
    const { container } = renderDV(focus)
    expect(container.querySelector('a[href="/sheet/mech/m1"]')).toBeTruthy()
  })

  test('crawler focus → foot carries Enter Downtime + a crawler sheet link (D5)', () => {
    const focus: DialItem = {
      key: 'crawler:c1',
      kind: 'crawler',
      statless: false,
      label: 'Crawler · Hauler',
      tone: 'crawler',
      gauges: [],
    }
    const { container } = renderDV(focus)
    expect(container.querySelector('a[href="/sheet/crawler/c1"]')).toBeTruthy()
    const downtime = [...container.querySelectorAll('button')].some((b) =>
      b.textContent?.includes('Enter Downtime')
    )
    expect(downtime).toBe(true)
  })

  const tablesFocus: DialItem = {
    key: 'tables',
    kind: 'tables',
    statless: true,
    label: 'Tables',
    sublabel: 'roll',
  }

  test('Tables focus → a RollTable renders under the picker bar (D3)', () => {
    const { container } = renderDV(tablesFocus)
    expect(container.querySelector('.pc-display-scroll')).toBeTruthy()
    // The picker bar replaces the old <select>.
    expect(container.querySelector('[aria-haspopup="dialog"]')).toBeTruthy()
    expect(container.querySelector('select')).toBeNull()
    // The reused RollTable renders a real table (not the fallback note).
    expect(container.querySelector('table')).toBeTruthy()
    expect(container.querySelector('.pc-display-note')).toBeNull()
  })

  test('Tables picker → opens a 5-column category overlay (D3)', () => {
    const { container, getByLabelText } = renderDV(tablesFocus)
    expect(container.querySelector('.pc-tablepick')).toBeNull()
    const openBtn = container.querySelector('[aria-haspopup="dialog"]') as HTMLButtonElement
    fireEvent.click(openBtn)
    const overlay = container.querySelector('[role="dialog"]')
    expect(overlay).toBeTruthy()
    const cats = [...container.querySelectorAll('.pc-tablepick-cat')].map((c) => c.textContent)
    expect(cats).toEqual(['Combat', 'Pilot', 'Salvage', 'Crawler', 'Downtime'])
    // Closing removes the overlay.
    fireEvent.click(getByLabelText('Close table picker'))
    expect(container.querySelector('.pc-tablepick')).toBeNull()
  })

  test('Tables picker → picking a table updates the bar and closes (D3)', () => {
    const { container } = renderDV(tablesFocus)
    fireEvent.click(container.querySelector('[aria-haspopup="dialog"]') as HTMLButtonElement)
    const items = [...container.querySelectorAll('.pc-tablepick-item')] as HTMLButtonElement[]
    const initiative = items.find((b) => b.textContent === 'Group Initiative')
    expect(initiative).toBeTruthy()
    fireEvent.click(initiative as HTMLButtonElement)
    // Overlay closed and the mini-bar now names the picked table.
    expect(container.querySelector('.pc-tablepick')).toBeNull()
    expect(container.querySelector('[aria-haspopup="dialog"]')?.textContent).toContain(
      'Group Initiative'
    )
  })

  test('Tables → rolling records a roll-history row (D3)', async () => {
    const { container } = renderDV(tablesFocus)
    const rollBtn = container.querySelector(
      'button[aria-label="Roll on this table"]'
    ) as HTMLButtonElement
    expect(rollBtn).toBeTruthy()
    fireEvent.click(rollBtn)
    await waitFor(() => expect(container.querySelector('.pc-rollhist-row')).toBeTruthy())
    // Clear empties the history.
    fireEvent.click(
      [...container.querySelectorAll('button')].find(
        (b) => b.textContent === 'Clear'
      ) as HTMLButtonElement
    )
    expect(container.querySelector('.pc-rollhist')).toBeNull()
  })

  test('Actions focus → the interactive ActionsDeck (Phase 5)', () => {
    const focus: DialItem = {
      key: 'actions',
      kind: 'actions',
      statless: true,
      label: 'Actions',
      sublabel: 'deck',
    }
    const { container } = renderDV(focus)
    // The deck renders (list or empty state), never the generic placeholder note.
    expect(container.querySelector('.pc-display-scroll')).toBeTruthy()
    expect(container.querySelector('.pc-deck, .pc-deck-empty')).toBeTruthy()
    expect(container.querySelector('.pc-display-note')).toBeNull()
  })

  test('SRD focus → the interactive SrdExplorer (D4)', () => {
    const focus: DialItem = {
      key: 'srd',
      kind: 'srd',
      statless: true,
      label: 'SRD Explorer',
      sublabel: 'reference browser',
    }
    const { container } = renderDV(focus)
    // The explorer renders its search + tiles, never the generic placeholder.
    expect(container.querySelector('.pc-srd-input')).toBeTruthy()
    expect(container.querySelectorAll('.pc-srd-tile').length).toBe(8)
    expect(container.querySelector('.pc-display-note')).toBeNull()
  })

  test('no focus → graceful empty note', () => {
    const { container } = renderDV(undefined)
    expect(container.querySelector('.pc-display-note')?.textContent).toContain('Nothing selected')
  })
})
