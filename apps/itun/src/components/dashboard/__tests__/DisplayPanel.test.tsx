/**
 * Tests for DisplayPanel — the Dashboard's main display. Verifies each focus
 * renders without throwing and reuses the real reference components:
 * a resolvable chassis → a ReferenceEntityCard card; Tables → a RollTable;
 * unresolvable slugs → a graceful note (never a crash).
 *
 * Reference content needs the ORM, so preload('all') runs once. A real chassis
 * slug is picked from the loaded set so the card path is genuinely exercised.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { EntityHrefProvider } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { crawlerFixture, mechFixture } from '../../__tests__/fixtures'
import { hydrateStores } from '../../__tests__/hydrateStores'
import type { DisplayFocus } from '../DisplayPanel'
import { DisplayPanel, DisplayPicker } from '../DisplayPanel'
import { boardedSeat } from './seatFixture'

beforeAll(hydrateStores)

let chassisSlug = 'iron-mongrel'

beforeAll(async () => {
  const first = SalvageUnionReference.Chassis.all()[0] as { id?: string } | undefined
  if (first?.id) chassisSlug = first.id
})

function renderDV(focus: DisplayFocus, mechChassis = chassisSlug) {
  const mech = mechFixture({ id: 'm1', name: 'Rig', chassisRef: mechChassis })
  const crawler = crawlerFixture({ id: 'c1', name: 'Hauler', techLevel: '3' })
  return render(
    <EntityHrefProvider value={() => undefined}>
      <DisplayPanel
        focus={focus}
        mech={mech}
        pilot={null}
        crawler={crawler}
        mount="mech"
        seat={boardedSeat(mech.id).handle}
      />
    </EntityHrefProvider>
  )
}

describe('DisplayPanel', () => {
  test('mech focus → a resolvable chassis renders a reference card', () => {
    const focus: DisplayFocus = 'mech'
    const { container } = renderDV(focus)
    // The reference card renders real content, not the fallback note.
    expect(container.querySelector('.pc-display-note')).toBeNull()
    expect(container.querySelector('.pc-display-scroll')).toBeTruthy()
  })

  test('mech focus → an unresolvable chassis falls back to a note, no throw', () => {
    const focus: DisplayFocus = 'mech'
    const { container } = renderDV(focus, 'definitely-not-a-chassis')
    expect(container.querySelector('.pc-entity-fallback')?.textContent).toContain(
      'not in the reference set'
    )
  })

  test('mech focus → foot carries a "Full mech sheet" link (D5)', () => {
    const focus: DisplayFocus = 'mech'
    const { container } = renderDV(focus)
    expect(container.querySelector('a[href="/sheet/mech/m1"]')).toBeTruthy()
  })

  test('crawler focus → foot carries Enter Downtime + a crawler sheet link (D5)', () => {
    const focus: DisplayFocus = 'crawler'
    const { container } = renderDV(focus)
    expect(container.querySelector('a[href="/sheet/crawler/c1"]')).toBeTruthy()
    const downtime = [...container.querySelectorAll('button')].some((b) =>
      b.textContent?.includes('Enter Downtime')
    )
    expect(downtime).toBe(true)
  })

  const tablesFocus: DisplayFocus = 'tables'

  test('Tables focus → a RollTable whose title is the picker trigger (D3)', () => {
    const { container } = renderDV(tablesFocus)
    expect(container.querySelector('.pc-display-scroll')).toBeTruthy()
    // The trigger lives IN the RollTable header band — the band that also
    // carries the Roll control — rather than in a bar above it repeating the
    // name that band already prints.
    const trigger = container.querySelector('[aria-haspopup="dialog"]')
    expect(trigger).toBeTruthy()
    expect(
      trigger?.closest('div')?.querySelector('button[aria-label="Roll on this table"]')
    ).toBeTruthy()
    expect(trigger?.textContent).toContain('Core Mechanic')
    expect(trigger?.getAttribute('aria-expanded')).toBe('false')
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
    expect(openBtn.getAttribute('aria-expanded')).toBe('true')
    const cats = [...container.querySelectorAll('.pc-tablepick-cat')].map((c) => c.textContent)
    expect(cats).toEqual(['Combat', 'Pilot', 'Salvage', 'Crawler', 'Downtime'])
    // Closing removes the overlay.
    fireEvent.click(getByLabelText('Close table picker'))
    expect(container.querySelector('.pc-tablepick')).toBeNull()
  })

  test('Tables picker → picking a table retitles the table and closes (D3)', () => {
    const { container } = renderDV(tablesFocus)
    fireEvent.click(container.querySelector('[aria-haspopup="dialog"]') as HTMLButtonElement)
    const items = [...container.querySelectorAll('.pc-tablepick-item')] as HTMLButtonElement[]
    const initiative = items.find((b) => b.textContent === 'Group Initiative')
    expect(initiative).toBeTruthy()
    fireEvent.click(initiative as HTMLButtonElement)
    // Overlay closed and the header title now names the picked table.
    expect(container.querySelector('.pc-tablepick')).toBeNull()
    expect(container.querySelector('[aria-haspopup="dialog"]')?.textContent).toContain(
      'Group Initiative'
    )
    expect(container.querySelector('caption')?.textContent).toBe('Group Initiative')
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
    const focus: DisplayFocus = 'actions'
    const { container } = renderDV(focus)
    // The deck renders (list or empty state), never the generic placeholder note.
    expect(container.querySelector('.pc-display-scroll')).toBeTruthy()
    expect(container.querySelector('.pc-deck, .pc-deck-empty')).toBeTruthy()
    expect(container.querySelector('.pc-display-note')).toBeNull()
  })

  test('SRD focus → the interactive SrdExplorer (D4)', () => {
    const focus: DisplayFocus = 'srd'
    const { container } = renderDV(focus)
    // The explorer renders its search + the SRD catalog, never the generic
    // placeholder. The catalog's exact contents are component-lib's business
    // (asserted there against `buildCatalogSections`); here we only care that
    // the real explorer mounted.
    expect(container.querySelector('input[role="combobox"]')).toBeTruthy()
    expect(container.querySelectorAll('.pc-srd-catalog-grid button').length).toBeGreaterThan(0)
    expect(container.querySelector('.pc-display-note')).toBeNull()
  })
})

describe('DisplayPicker', () => {
  const options = [
    { focus: 'actions', label: 'Actions' },
    { focus: 'tables', label: 'Tables' },
  ] as const

  test('marks the shown view pressed, and asks for another on click', () => {
    const asked: DisplayFocus[] = []
    const { getByRole } = render(
      <DisplayPicker focus="actions" options={options} onFocus={(f) => asked.push(f)} />
    )
    expect(getByRole('button', { name: 'Actions' }).getAttribute('aria-pressed')).toBe('true')
    expect(getByRole('button', { name: 'Tables' }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(getByRole('button', { name: 'Tables' }))
    expect(asked).toEqual(['tables'])
  })

  test('is a group of toggle buttons, not a tablist without a keyboard model', () => {
    const { container } = render(
      <DisplayPicker focus="actions" options={options} onFocus={() => {}} />
    )
    expect(container.querySelector('fieldset')?.getAttribute('aria-label')).toBe('Display')
    expect(container.querySelector('[role="tablist"], [role="tab"], [role="listbox"]')).toBeNull()
  })
})
