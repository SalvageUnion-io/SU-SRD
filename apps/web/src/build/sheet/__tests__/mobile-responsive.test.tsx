/**
 * Mobile-responsive regression tests for sheet components.
 *
 * Sheet renders without horizontal overflow at 320px viewport width.
 * The top-bar Share control and a Field's edit-state readout have ≥44px touch targets
 *       (verified via the coarse-pointer floor every `.su-btn` gets, the Share control
 *       included, and the inline `min-height` (`size.full`, 44px) on the readout).
 *
 * Design choices:
 * - 320px overflow check: happy-dom does not implement a full layout engine, so
 *   scrollWidth and clientWidth are both 0 regardless of CSS. The overflow
 *   assertion below is therefore replaced with a render-completeness check
 *   (entity content appears without throwing). Real 320px overflow verification
 *   requires a browser engine — this is tracked in the M3 a11y/perf work and
 *   should be covered by a Playwright / puppeteer visual regression test.
 * - Touch target: we assert the Share button is a `.su-btn` at the page-top
 *   height (`.su-page-action`), and that `theme.css`'s coarse-pointer floor
 *   lifts every `.su-btn` to 44px; and a Field's edit-state readout its inline
 *   `minHeight` (a style object). Both are the most
 *   reliable assertions in happy-dom (no computed styles).
 *
 * Conventions:
 * - toBeTruthy() not toBeInTheDocument()
 * - No mock.module()
 * - Dep-injection for entityStore and softLinkStore
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import {
  crawlerFixture,
  mechFixture,
  pilotFixture,
  softLinkFixture,
} from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import {
  makeEntityLookupMock,
  makeSoftLinkStoreMock,
} from '../../../components/__tests__/mockEntityStore'
import { Field } from '../../../components/index'
import { Sheet } from '../Sheet'

beforeAll(hydrateStores)

// ---------------------------------------------------------------------------
// Shared fixtures (mirrors Sheet.test.tsx)
// ---------------------------------------------------------------------------

const fakePilot = pilotFixture({
  id: 'pilot-1',
  name: 'Yara Voss',
  callsign: 'Ghost',
  abilities: ['scavenge'],
  equipment: ['pistol'],
  motto: 'Waste not.',
  keepsake: 'A bent coin.',
  appearance: 'Tall, weathered.',
})

const fakeMech = mechFixture({
  id: 'mech-1',
  name: 'Iron Fist',
  chassisRef: 'iron-mongrel',
  systems: ['heavy-blaster'],
  modules: ['shield-cell'],
  cargoLots: [
    {
      id: 'lot-medkit',
      kind: 'unit' as const,
      name: 'med-kit',
      cat: 'SEALED' as const,
      units: 1,
      code: 'MED',
    },
  ],
})

const fakeCrawler = crawlerFixture({
  id: 'crawler-1',
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  crawlerBays: [{ bayRef: 'command-bay', npcCurrentHP: 4 }],
  systems: ['hull-repair'],
})

// ---------------------------------------------------------------------------
// No horizontal overflow at 320px
// ---------------------------------------------------------------------------

describe('Mobile responsive — renders without error at 320px container', () => {
  // NOTE: happy-dom does not implement a real layout engine — scrollWidth and
  // clientWidth are both 0 regardless of CSS, making overflow assertions vacuous.
  // These tests assert instead that each Sheet variant renders its core entity
  // content correctly inside a 320px container (render-completeness check).
  // Real 320px horizontal-overflow verification is deferred to M3 a11y/perf work
  // and should be covered by a Playwright / puppeteer browser-engine test.

  test('pilot-only Sheet renders entity name inside 320px container', () => {
    const wrapper = document.createElement('div')
    wrapper.style.width = '320px'
    document.body.appendChild(wrapper)

    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />,
      { container: wrapper }
    )

    // Render-completeness: pilot name visible (would throw if render crashes)
    expect(screen.getAllByText(/Yara Voss/).length).toBeGreaterThan(0)

    document.body.removeChild(wrapper)
  })

  test('mech-only Sheet renders entity name inside 320px container', () => {
    const wrapper = document.createElement('div')
    wrapper.style.width = '320px'
    document.body.appendChild(wrapper)

    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityLookupMock([fakeMech])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />,
      { container: wrapper }
    )

    expect(screen.getAllByText(/Iron Fist/).length).toBeGreaterThan(0)

    document.body.removeChild(wrapper)
  })

  test('crawler-only Sheet renders entity name inside 320px container', () => {
    const wrapper = document.createElement('div')
    wrapper.style.width = '320px'
    document.body.appendChild(wrapper)

    render(
      <Sheet
        kind="crawler"
        id="crawler-1"
        entityStore={makeEntityLookupMock([fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />,
      { container: wrapper }
    )

    expect(screen.getAllByText(/Iron Tortoise/).length).toBeGreaterThan(0)

    document.body.removeChild(wrapper)
  })
})

// ---------------------------------------------------------------------------
// Touch targets ≥44px on mobile
// ---------------------------------------------------------------------------

describe('Mobile responsive — 44px touch targets', () => {
  test("a Field's edit-state readout carries a 44px min-height", () => {
    render(<Field label="Callsign" value="Ghost" onSave={() => Promise.resolve()} />)
    // The edit state's readout is a span with role=button.
    const displayEl = screen.getByRole('button', { name: 'Edit callsign' })
    expect((displayEl as HTMLElement).style.minHeight).toBe('44px')
  })

  test('the top-bar Share control carries the 44px touch-target floor', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    // A button since the share screen was deleted — same target, same rule.
    const share = screen.getByRole('button', { name: /share this pilot/i })
    const className = (share as HTMLElement).className
    expect(className).toContain('su-btn')
    expect(className).toContain('su-page-action')
    // …and a touch screen lifts every `.su-btn` to the 44px floor.
    const css = readFileSync(new URL(import.meta.resolve('../../../styles/theme.css')), 'utf8')
    expect(css).toMatch(
      /@media \(pointer: coarse\) \{[\s\S]*?\.su-btn:not\(\.su-btn--mini, \.su-hit-area\)[^}]*min-height: var\(--size-full\);/
    )
  })
})

// ---------------------------------------------------------------------------
// LiveSheet shell: linked entities live in the rail, not a segment switcher
// (one entity per sheet).
// ---------------------------------------------------------------------------

describe('LiveSheet rail replaces the segment switcher', () => {
  test('no tablist renders on any sheet', () => {
    const link = softLinkFixture('mech-to-pilot', 'mech-1', 'pilot-1')
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityLookupMock([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([link])}
      />
    )
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  test('wired (mech+pilot) Sheet shows the pilot as a navigating linked row', () => {
    const link = softLinkFixture('mech-to-pilot', 'mech-1', 'pilot-1')
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityLookupMock([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([link])}
      />
    )
    // Assigned units render the library Row (`UnitRow`), whose View link is labelled
    // "View" on every row — so the row is targeted by its DESTINATION, which is
    // what this test was ever asserting.
    const viewLink = screen
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === '/sheet/pilot/pilot-1')
    expect(viewLink).toBeTruthy()
  })
})
