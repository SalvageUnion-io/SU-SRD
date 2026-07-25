/**
 * Sheet pipeline smoke tests — consolidated end-to-end-ish coverage of the
 * entire sheet rendering pipeline.
 *
 * Strategy: dep-injection throughout (no mock.module()). Each scenario
 * exercises the Sheet → sub-component → store integration as a whole, rather
 * than testing a single sub-component in isolation.
 *
 * Scenarios:
 *   1.  Pilot-only sheet renders (no links → PilotSheet visible)
 *   2.  Mech-only sheet renders (no links → MechSheet visible)
 *   3.  Crawler-only sheet renders (no links → CrawlerSheet visible)
 *   4.  Wired composition: mech-to-pilot link → both PilotSheet + MechSheet
 *   5.  Empty-rail case: mech with no link → pilot RailEmpty visible
 *   6.  Stat-edit round-trip via the Sheet hero trackers (StatBlock steppers)
 *   7.  Top-bar Share entry: PublishButton links to /sheet/:kind/:id/share
 *   8.  SnapshotPageInner 404 path: notFound=true → "Snapshot not found" heading
 *   9.  Read-only mode: Sheet readOnly=true → Share link NOT rendered
 *
 * Conventions:
 *   - toBeTruthy() not toBeInTheDocument() (happy-dom workaround)
 *   - No mock.module()
 *   - afterEach cleanup()
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Sheet } from '../Sheet'
import type { EntityLookup } from '../Sheet'
import type { SoftLinkStore } from '../../wiring/useSoftLinks'
import type { SoftLink } from '../../../lib/schemas/softLink'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { Mech } from '../../../lib/schemas/mech'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { useEntityStore } from '../../../stores/entityStore'
import {
  makeEntityStoreMock,
  makeEntityLookupMock,
  makeSoftLinkStoreMock,
} from '../../__tests__/mockEntityStore'
import { SnapshotPageInner } from '../../../routes/s/$id'
import { must } from '../../__tests__/must'

// ---------------------------------------------------------------------------
// Preload salvageunion-reference once — MechSheet resolves chassis refs
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Shared fake entities
// ---------------------------------------------------------------------------

const fakePilot: Pilot = {
  id: 'pilot-smoke-1',
  schemaVersion: 1,
  name: 'Riko Vane',
  callsign: 'Spark',
  classRef: 'mechanic',
  abilities: ['fast-repair'],
  equipment: ['wrench'],
  motto: 'Fix it fast.',
  keepsake: 'Worn goggles.',
  appearance: 'Compact, oil-stained.',
  background: '',
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeMech: Mech = {
  id: 'mech-smoke-1',
  schemaVersion: 1,
  name: 'Steel Coffin',
  chassisRef: 'iron-mongrel',
  systems: ['rail-gun'],
  modules: ['shield-cell'],
  cargoLots: [],
  conditions: [],
  currentHP: 8,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeCrawler: Crawler = {
  id: 'crawler-smoke-1',
  schemaVersion: 1,
  name: 'Rust Colossus',
  techLevel: 'tech-2',
  crawlerBays: [{ bayRef: 'command-bay', npcCurrentHP: 4 }],
  systems: ['hull-repair'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// ---------------------------------------------------------------------------
// Store / SoftLink factories (reused across tests)
// ---------------------------------------------------------------------------

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

/**
 * Build a minimal Zustand-shaped store stub for MechSheet's `store` prop.
 * Only `get` and `update` are exercised by the click-to-edit path.
 */
function makeZustandLikeStore(
  mechs: Mech[],
  onUpdate?: (id: string, patch: Partial<Mech>) => void
): typeof useEntityStore {
  const updateMock = mock(async (_type: string, id: string, patch: Partial<Mech>) => {
    onUpdate?.(id, patch)
    const entity = mechs.find((e) => e.id === id)
    return { ...entity, ...patch } as Mech
  })

  return makeEntityStoreMock({
    mechs,
    hydrated: { pilots: false, mechs: true, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => mechs),
    get: mock((_type: string, id: string) => mechs.find((e) => e.id === id) ?? null),
    create: mock(async () => mechs[0] ?? null),
    update: updateMock,
    delete: mock(async () => {}),
  })
}

// ---------------------------------------------------------------------------
// Scenario 1 — Pilot-only sheet renders
// ---------------------------------------------------------------------------

describe('Smoke — pilot-only sheet', () => {
  test('PilotSheet section is visible: pilot name rendered', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-smoke-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getAllByText(/Riko Vane/).length).toBeGreaterThan(0)
  })

  test('pilot class ref appears in the sheet section', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-smoke-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getAllByText(/mechanic/i).length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Scenario 2 — Mech-only sheet renders
// ---------------------------------------------------------------------------

describe('Smoke — mech-only sheet', () => {
  test('MechSheet section is visible: mech name rendered', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-smoke-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getAllByText(/Steel Coffin/).length).toBeGreaterThan(0)
  })

  test('mech system slug appears in the sheet', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-smoke-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByText('rail-gun')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Scenario 3 — Crawler-only sheet renders
// ---------------------------------------------------------------------------

describe('Smoke — crawler-only sheet', () => {
  test('CrawlerSheet section is visible: crawler name rendered', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-smoke-1"
        entityStore={makeEntityStore([fakeCrawler])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getAllByText(/Rust Colossus/).length).toBeGreaterThan(0)
  })

  test('crawler tech level appears in the sheet (economy rail Tech LVL readout)', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-smoke-1"
        entityStore={makeEntityStore([fakeCrawler])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByText('Tech LVL')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Scenario 4 — Wired composition: mech + pilot link → both sheets visible
// ---------------------------------------------------------------------------

describe('Smoke — wired composition (mech→pilot)', () => {
  const link = makeMechToPilotLink('mech-smoke-1', 'pilot-smoke-1')

  test('both PilotSheet and MechSheet content visible', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-smoke-1"
        entityStore={makeEntityStore([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStore([link])}
      />
    )
    // Pilot name — PilotSheet renders it
    expect(screen.getAllByText(/Riko Vane/).length).toBeGreaterThan(0)
    // Mech name — rendered by the LiveSheet hero (and condensed strip)
    expect(screen.getAllByText(/Steel Coffin/).length).toBeGreaterThan(0)
  })

  test('no pilot RailEmpty when pilot is wired', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-smoke-1"
        entityStore={makeEntityStore([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStore([link])}
      />
    )
    expect(screen.queryByLabelText('No pilot assigned')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Scenario 5 — Empty-rail case: mech with no link → pilot RailEmpty visible
// ---------------------------------------------------------------------------

describe('Smoke — mech stand-in (no pilot link)', () => {
  test('pilot RailEmpty renders when mech has no wired pilot', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-smoke-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByText(/No pilot assigned/)).toBeTruthy()
  })

  test('PilotSheet NOT rendered when mech has no wired pilot', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-smoke-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    // Pilot name should not appear
    expect(screen.queryByText(/Riko Vane/)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Scenario 6 — Stat-edit round-trip via the Sheet hero trackers
//
// Stat editing lives in the hero VitalGauges now (Sheet.tsx): clicking a
// track segment patches current* fields through the injected store. This
// exercises the Sheet → SheetHero → VitalGauge → store.update pipeline.
// ---------------------------------------------------------------------------

describe('Smoke — stat-edit round-trip (Sheet hero trackers)', () => {
  test('clicking the top SP gauge segment calls store.update with currentSP', async () => {
    const statMech: Mech = {
      ...fakeMech,
      id: 'mech-smoke-stat',
      // Real chassis (Scrapper, SP 9) — the hero derives maxima from the ORM.
      chassisRef: 'Scrapper',
      currentSP: 5,
    }
    const captured: Array<{ id: string; patch: Partial<Mech> }> = []
    const store = makeZustandLikeStore([statMech], (id, patch) => captured.push({ id, patch }))

    render(
      <Sheet
        kind="mech"
        id="mech-smoke-stat"
        entityStore={makeEntityStore([statMech])}
        softLinkStore={makeSoftLinkStore([])}
        store={store}
      />
    )

    await act(async () => {
      // SP is a VitalGauge now: clicking the top-lit segment (index 4 =
      // "Set SP to 5") steps SP 5 → 4 (pipClickValue click-to-set).
      fireEvent.click(screen.getByRole('button', { name: 'Set SP to 5' }))
    })

    expect(captured.length).toBe(1)
    expect(must(captured[0]).id).toBe('mech-smoke-stat')
    expect(must(captured[0]).patch).toMatchObject({ currentSP: 4 })
  })
})

// ---------------------------------------------------------------------------
// Scenario 7 — top-bar Share entry point
//
// Publishing moved to the Share Snapshot screen (plan 5.2): the top bar just
// links into /sheet/:kind/:id/share. The publish flow itself is covered in
// ShareSnapshotScreen.test.tsx. Asserted through Sheet — the PublishButton
// wrapper it used to go through was a single-call-site alias for this link.
// ---------------------------------------------------------------------------

describe('Smoke — the top-bar Share link points at the share screen', () => {
  test('Share links to /sheet/pilot/:id/share', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-smoke-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )

    const link = screen.getByRole('link', { name: /share this pilot/i })
    expect(link.getAttribute('href')).toBe('/sheet/pilot/pilot-smoke-1/share')
  })
})

// ---------------------------------------------------------------------------
// Scenario 8 — SnapshotPageInner 404 path
// ---------------------------------------------------------------------------

describe('Smoke — SnapshotPageInner 404', () => {
  test('notFound=true renders "Snapshot not found" heading', () => {
    render(<SnapshotPageInner snapshot={null} notFound={true} error={null} />)
    expect(screen.getByRole('heading', { name: /snapshot not found/i })).toBeTruthy()
  })

  test('notFound=true renders a back-to-dashboard link', () => {
    render(<SnapshotPageInner snapshot={null} notFound={true} error={null} />)
    expect(screen.getByRole('link', { name: /back to roster/i })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Scenario 9 — Read-only mode: Sheet readOnly=true → no PublishButton
// ---------------------------------------------------------------------------

describe('Smoke — readOnly mode', () => {
  test('Sheet with readOnly=true does NOT render the Share link', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-smoke-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
        readOnly={true}
      />
    )
    expect(screen.queryByRole('link', { name: /share this pilot/i })).toBeNull()
  })

  test('Sheet with readOnly=false (default) renders the Share link', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-smoke-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByRole('link', { name: /share this pilot/i })).toBeTruthy()
  })
})
