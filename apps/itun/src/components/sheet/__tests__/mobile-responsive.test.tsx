/**
 * Mobile-responsive regression tests for sheet components.
 *
 * AC-1: Sheet renders without horizontal overflow at 320px viewport width.
 * AC-5: the top-bar Share link and InlineEditField display state have ≥44px touch targets
 *       (verified via class attribute containing min-h-11).
 *
 * Design choices:
 * - 320px overflow check: happy-dom does not implement a full layout engine, so
 *   scrollWidth and clientWidth are both 0 regardless of CSS. The overflow
 *   assertion below is therefore replaced with a render-completeness check
 *   (entity content appears without throwing). Real 320px overflow verification
 *   requires a browser engine — this is tracked in the M3 a11y/perf work and
 *   should be covered by a Playwright / puppeteer visual regression test.
 * - Touch target: we assert the display-state span/button carries `min-h-11`
 *   in its className string, matching the Tailwind class applied in the source.
 *   This is the most reliable assertion in happy-dom (no computed styles).
 *
 * Conventions:
 * - toBeTruthy() not toBeInTheDocument()
 * - No mock.module()
 * - Dep-injection for entityStore and softLinkStore
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Sheet } from '../Sheet'
import type { EntityLookup } from '../Sheet'
import type { SoftLinkStore } from '../../wiring/useSoftLinks'
import { InlineEditField } from 'component-lib'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { Mech } from '../../../lib/schemas/mech'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { SoftLink } from '../../../lib/schemas/softLink'
import { makeEntityLookupMock, makeSoftLinkStoreMock } from '../../__tests__/mockEntityStore'

// ---------------------------------------------------------------------------
// Preload salvageunion-reference so MechSheet.chassis resolution doesn't throw
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Shared fixtures (mirrors Sheet.test.tsx)
// ---------------------------------------------------------------------------

const fakePilot: Pilot = {
  id: 'pilot-1',
  schemaVersion: 1,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: ['scavenge'],
  equipment: ['pistol'],
  motto: 'Waste not.',
  keepsake: 'A bent coin.',
  appearance: 'Tall, weathered.',
  background: '',
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeMech: Mech = {
  id: 'mech-1',
  schemaVersion: 1,
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
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeCrawler: Crawler = {
  id: 'crawler-1',
  schemaVersion: 1,
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  crawlerBays: [{ bayRef: 'command-bay', npcCurrentHP: 4 }],
  systems: ['hull-repair'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

type AnyEntity = Pilot | Mech | Crawler

function makeEntityStore(entities: AnyEntity[]): EntityLookup {
  return makeEntityLookupMock(entities)
}

function makeSoftLinkStore(links: SoftLink[]): SoftLinkStore {
  return makeSoftLinkStoreMock(links)
}

function makeMechToPilotLink(mechId: string, pilotId: string): SoftLink {
  return {
    id: `link-${mechId}-${pilotId}`,
    from: { type: 'mech', id: mechId },
    to: { type: 'pilot', id: pilotId },
    type: 'mech-to-pilot',
    createdAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// AC-1: No horizontal overflow at 320px
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
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
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
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeSoftLinkStore([])}
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
        entityStore={makeEntityStore([fakeCrawler])}
        softLinkStore={makeSoftLinkStore([])}
      />,
      { container: wrapper }
    )

    expect(screen.getAllByText(/Iron Tortoise/).length).toBeGreaterThan(0)

    document.body.removeChild(wrapper)
  })
})

// ---------------------------------------------------------------------------
// AC-5: Touch targets ≥44px on mobile
// ---------------------------------------------------------------------------

describe('Mobile responsive — touch targets min-h-11', () => {
  test('InlineEditField display state carries min-h-11 class', () => {
    render(
      <InlineEditField
        value={42}
        onSave={() => Promise.resolve()}
        type="number"
        ariaLabel="Edit HP"
      />
    )
    // Display state renders a span with role=button
    const displayEl = screen.getByRole('button')
    expect((displayEl as HTMLElement).className).toContain('min-h-11')
  })

  test('InlineEditField readOnly display state also carries min-h-11 class', () => {
    const { container } = render(
      <InlineEditField value={42} onSave={() => Promise.resolve()} type="number" readOnly />
    )
    // readOnly renders no button role — get via container querySelector
    const span = container.querySelector('span')
    expect(span).toBeTruthy()
    expect((span as HTMLElement).className).toContain('min-h-11')
  })

  test('the top-bar Share link carries min-h-11 (AC-5 touch target)', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    const link = screen.getByRole('link', { name: /share this pilot/i })
    expect((link as HTMLElement).className).toContain('min-h-11')
  })
})

// ---------------------------------------------------------------------------
// LiveSheet shell: linked entities live in the rail (the #255 segment
// switcher was removed with the Header C rebuild — one entity per sheet).
// ---------------------------------------------------------------------------

describe('LiveSheet rail replaces the segment switcher', () => {
  test('no tablist renders on any sheet', () => {
    const link = makeMechToPilotLink('mech-1', 'pilot-1')
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityStore([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStore([link])}
      />
    )
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  test('wired (mech+pilot) Sheet shows the pilot as a navigating rail chip', () => {
    const link = makeMechToPilotLink('mech-1', 'pilot-1')
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityStore([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStore([link])}
      />
    )
    const chip = screen.getByLabelText(/Assigned Pilot: Yara Voss/i)
    expect(chip).toBeTruthy()
    expect(chip.getAttribute('href')).toBe('/sheet/pilot/pilot-1')
  })
})
