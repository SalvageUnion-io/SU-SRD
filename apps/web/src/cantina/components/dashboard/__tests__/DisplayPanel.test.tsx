/**
 * Tests for DisplayPanel — what the display's Reference, Tables and SRD tabs
 * show. Verifies each focus renders without throwing and reuses the real
 * reference components: a resolvable chassis → a ReferenceEntityCard card;
 * Tables → the roll instrument, whose rolls are handed on for the Game's log;
 * unresolvable slugs → a graceful note (never a crash).
 *
 * Reference content needs the ORM, so preload('all') runs once. A real chassis
 * slug is picked from the loaded set so the card path is genuinely exercised.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntityHrefProvider } from '../../../../ui/index'
import { crawlerFixture, mechFixture } from '../../__tests__/fixtures'
import { hydrateStores } from '../../__tests__/hydrateStores'
import type { DisplayFocus, ReferenceFocus } from '../DisplayPanel'
import { DisplayPanel, DisplayPanelFrame, DisplayPicker } from '../DisplayPanel'
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
    expect(container.querySelector('.su-dash-display-note')).toBeNull()
    expect(container.querySelector('.su-dash-display-scroll')).toBeTruthy()
  })

  test('mech focus → an unresolvable chassis falls back to a note, no throw', () => {
    const focus: DisplayFocus = 'mech'
    const { container } = renderDV(focus, 'definitely-not-a-chassis')
    expect(container.querySelector('.su-dash-entity-fallback')?.textContent).toContain(
      'not in the reference set'
    )
  })

  test('mech focus → foot carries a "Full mech sheet" link', () => {
    const focus: DisplayFocus = 'mech'
    const { container } = renderDV(focus)
    expect(container.querySelector('a[href="/sheet/mech/m1"]')).toBeTruthy()
  })

  test('crawler focus → foot carries a crawler sheet link, and no way into Downtime', () => {
    const focus: DisplayFocus = 'crawler'
    const { container } = renderDV(focus)
    expect(container.querySelector('a[href="/sheet/crawler/c1"]')).toBeTruthy()
    // Downtime is the Game's: the Mediator starts it for everyone from the rail.
    const downtime = [...container.querySelectorAll('button')].some((b) =>
      b.textContent?.includes('Downtime')
    )
    expect(downtime).toBe(false)
  })

  const tablesFocus: DisplayFocus = 'tables'

  test('Tables focus → the roll instrument, whose title is the picker trigger', () => {
    const { container } = renderDV(tablesFocus)
    expect(container.querySelector('.su-dash-display-scroll')).toBeTruthy()
    // The trigger lives IN the instrument's bar — the bar that also carries
    // the Roll control — rather than in a bar above it repeating the name that
    // bar already prints.
    const trigger = container.querySelector('[aria-haspopup="dialog"]')
    expect(trigger).toBeTruthy()
    expect(
      trigger
        ?.closest('.su-roll__bar')
        ?.querySelector('button[aria-label="Roll the die on Core Mechanic"]')
    ).toBeTruthy()
    expect(trigger?.textContent).toContain('Core Mechanic')
    expect(trigger?.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('select')).toBeNull()
    // The instrument renders the table's bands (not the fallback note).
    expect(container.querySelector('ol[aria-label="Core Mechanic table"]')).toBeTruthy()
    expect(container.querySelector('.su-dash-display-note')).toBeNull()
  })

  test('Tables picker → opens a 5-column category overlay', () => {
    const { container, getByLabelText } = renderDV(tablesFocus)
    expect(container.querySelector('.su-dash-tablepick')).toBeNull()
    const openBtn = container.querySelector('[aria-haspopup="dialog"]') as HTMLButtonElement
    fireEvent.click(openBtn)
    const overlay = container.querySelector('[role="dialog"]')
    expect(overlay).toBeTruthy()
    expect(openBtn.getAttribute('aria-expanded')).toBe('true')
    const cats = [...container.querySelectorAll('.su-dash-tablepick-cat')].map((c) => c.textContent)
    expect(cats).toEqual(['Combat', 'Pilot', 'Salvage', 'Crawler', 'Downtime'])
    // Closing removes the overlay.
    fireEvent.click(getByLabelText('Close table picker'))
    expect(container.querySelector('.su-dash-tablepick')).toBeNull()
  })

  test('Tables picker → takes focus, closes on Escape and hands focus back', async () => {
    const { container } = renderDV(tablesFocus)
    const openBtn = container.querySelector('[aria-haspopup="dialog"]') as HTMLButtonElement
    openBtn.focus()
    await act(async () => {
      fireEvent.click(openBtn)
    })
    const overlay = container.querySelector('[role="dialog"]') as HTMLElement
    expect(overlay.contains(document.activeElement)).toBe(true)
    await act(async () => {
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
    })
    expect(container.querySelector('.su-dash-tablepick')).toBeNull()
    expect(document.activeElement).toBe(openBtn)
  })

  test('Tables picker → picking a table retitles the table and closes', () => {
    const { container } = renderDV(tablesFocus)
    fireEvent.click(container.querySelector('[aria-haspopup="dialog"]') as HTMLButtonElement)
    const items = [...container.querySelectorAll('.su-dash-tablepick-item')] as HTMLButtonElement[]
    const initiative = items.find((b) => b.textContent === 'Group Initiative')
    expect(initiative).toBeTruthy()
    fireEvent.click(initiative as HTMLButtonElement)
    // Overlay closed and the header title now names the picked table.
    expect(container.querySelector('.su-dash-tablepick')).toBeNull()
    expect(container.querySelector('[aria-haspopup="dialog"]')?.textContent).toContain(
      'Group Initiative'
    )
    expect(container.querySelector('ol[aria-label="Group Initiative table"]')).toBeTruthy()
  })

  test('Tables → a roll is handed on for the Game log, and kept nowhere here', async () => {
    const rolled: string[][] = []
    const { container } = render(
      <EntityHrefProvider value={() => undefined}>
        <DisplayPanelFrame
          content={{
            kind: 'tables',
            onRoll: (table, key, text) => rolled.push([table, key, text]),
          }}
        />
      </EntityHrefProvider>
    )
    const rollBtn = container.querySelector(
      'button[aria-label="Roll the die on Core Mechanic"]'
    ) as HTMLButtonElement
    expect(rollBtn).toBeTruthy()
    fireEvent.click(rollBtn)
    await waitFor(() => expect(rolled).toHaveLength(1))
    expect(rolled[0]?.[0]).toBe('Core Mechanic')
  })

  test('SRD focus → the interactive SrdExplorer', () => {
    const focus: DisplayFocus = 'srd'
    const { container } = renderDV(focus)
    // The explorer renders its search + the SRD catalog, never the generic
    // placeholder. The catalog's exact contents are src/ui's business
    // (asserted there against `buildCatalogSections`); here we only care that
    // the real explorer mounted.
    expect(container.querySelector('input[role="combobox"]')).toBeTruthy()
    expect(container.querySelectorAll('section button').length).toBeGreaterThan(0)
    expect(container.querySelector('.su-dash-display-note')).toBeNull()
  })
})

describe('DisplayPicker (the Reference tab’s entity)', () => {
  const options = [
    { focus: 'pilot', label: 'Pilot' },
    { focus: 'mech', label: 'Mech' },
  ] as const

  test('marks the shown entity pressed, and asks for another on click', () => {
    const asked: ReferenceFocus[] = []
    const { getByRole } = render(
      <DisplayPicker focus="pilot" options={options} onFocus={(f) => asked.push(f)} />
    )
    expect(getByRole('button', { name: 'Pilot' }).getAttribute('aria-pressed')).toBe('true')
    expect(getByRole('button', { name: 'Mech' }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(getByRole('button', { name: 'Mech' }))
    expect(asked).toEqual(['mech'])
  })

  test('is a group of toggle buttons, not a tablist without a keyboard model', () => {
    const { container } = render(
      <DisplayPicker focus="pilot" options={options} onFocus={() => {}} />
    )
    expect(container.querySelector('fieldset')?.getAttribute('aria-label')).toBe('Reference')
    expect(container.querySelector('[role="tablist"], [role="tab"], [role="listbox"]')).toBeNull()
  })
})
