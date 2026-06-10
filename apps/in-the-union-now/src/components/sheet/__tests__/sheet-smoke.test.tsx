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
 *   5.  Stand-in case: mech with no link → PilotStandIn visible
 *   6.  Click-to-edit round-trip via MechSheet: click HP → type → Enter → store.update called
 *   7.  PublishButton click flow via Sheet: Share → dialog appears with URL
 *   8.  SnapshotPageInner 404 path: notFound=true → "Snapshot not found" heading
 *   9.  Read-only mode: Sheet readOnly=true → PublishButton NOT rendered
 *   10. Composition badge per scenario: wired mode shows "Wired" badge
 *
 * Conventions:
 *   - toBeTruthy() not toBeInTheDocument() (happy-dom workaround)
 *   - No mock.module()
 *   - afterEach cleanup()
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Sheet } from '../Sheet'
import type { EntityLookup } from '../Sheet'
import type { SoftLinkStore } from '../../wiring/useSoftLinks'
import type { SoftLink } from '../../../lib/schemas/softLink'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { Mech } from '../../../lib/schemas/mech'
import type { Crawler } from '../../../lib/schemas/crawler'
import { MechSheet } from '../MechSheet'
import type { useEntityStore } from '../../../stores/entityStore'
import type { PublishResult } from '../../../lib/snapshot/client'
import { PublishButton } from '../PublishButton'
import { SnapshotPageInner } from '../../../routes/s/$id'

// ---------------------------------------------------------------------------
// Preload salvageunion-reference once — MechSheet resolves chassis refs
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await SalvageUnionReference.preload(['chassis', 'systems', 'modules'])
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
  rollResults: [],
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
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (_type, id) => (entities.find((e) => e.id === id) ?? null) as any,
  }
}

function makeSoftLinkStore(links: SoftLink[]): SoftLinkStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMock = mock(async () => links[0]) as any
  return {
    softLinks: links,
    create: createMock,
    delete: mock(async () => undefined),
  }
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

  const storeState = {
    pilots: [],
    mechs,
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: true, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => mechs),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: mock((_type: string, id: string) => mechs.find((e) => e.id === id) ?? null) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: mock(async () => mechs[0]) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: updateMock as any,
    delete: mock(async () => {}),
  }

  return (() => storeState) as unknown as typeof useEntityStore
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
    expect(screen.getByText(/mechanic/i)).toBeTruthy()
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

  test('crawler tech level appears in the sheet', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-smoke-1"
        entityStore={makeEntityStore([fakeCrawler])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByText(/tech-2/i)).toBeTruthy()
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
    // Mech name — MechSheet renders it (SheetHeader shows it in h1 too)
    expect(screen.getAllByText(/Steel Coffin/).length).toBeGreaterThan(0)
  })

  test('no PilotStandIn when pilot is wired', () => {
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
// Scenario 5 — Stand-in case: mech with no link → PilotStandIn visible
// ---------------------------------------------------------------------------

describe('Smoke — mech stand-in (no pilot link)', () => {
  test('PilotStandIn renders when mech has no wired pilot', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-smoke-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByLabelText('No pilot assigned')).toBeTruthy()
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
// Scenario 6 — Click-to-edit round-trip via MechSheet
//
// Sheet.tsx does not pass a `store` prop through to MechSheet, so we test
// MechSheet directly with an injected store stub. This still exercises the
// full MechSheet → EditableStatRow → InlineEditField → store.update pipeline.
// ---------------------------------------------------------------------------

describe('Smoke — click-to-edit round-trip (MechSheet)', () => {
  test('clicking HP field, typing new value, and pressing Enter calls store.update', async () => {
    const captured: Array<{ id: string; patch: Partial<Mech> }> = []
    const store = makeZustandLikeStore([fakeMech], (id, patch) => captured.push({ id, patch }))

    const fakeChassis = {
      name: 'Iron Mongrel',
      structurePoints: 10,
      energyPoints: 6,
      heatCapacity: 8,
      systemSlots: 3,
      moduleSlots: 2,
      cargoCapacity: 4,
    }

    render(<MechSheet mech={fakeMech} chassis={fakeChassis} store={store} />)

    // EditableStatRow for HP renders a role=button (display mode)
    const hpButtons = screen.getAllByRole('button')
    expect(hpButtons.length).toBeGreaterThan(0)

    // Click the first button (HP is first in the stat grid)
    await act(async () => {
      fireEvent.click(hpButtons[0]!)
    })

    // Now in edit mode — spinbutton input is rendered
    const input = screen.getByRole('spinbutton')
    expect(input).toBeTruthy()

    await act(async () => {
      fireEvent.change(input, { target: { value: '5' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    // store.update should have been called with the correct patch shape
    expect(captured.length).toBe(1)
    expect(captured[0]!.id).toBe('mech-smoke-1')
    expect(captured[0]!.patch).toMatchObject({ currentHP: 5 })
  })
})

// ---------------------------------------------------------------------------
// Scenario 7 — PublishButton click flow
//
// Sheet.tsx does not propagate a `publishFn` prop to PublishButton, so we
// test PublishButton directly with an injected publishFn + entityStore.
// This validates the publish → dialog flow as a standalone integration path.
// ---------------------------------------------------------------------------

describe('Smoke — PublishButton click → ShareURLDialog appears', () => {
  test('clicking Share opens ShareURLDialog with the snapshot URL', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, origin: 'https://itun.example.com' },
      configurable: true,
    })

    const publishFn = mock(
      async (): Promise<PublishResult> => ({
        id: 'smoke-abc',
        url: '/api/snapshots/smoke-abc',
      })
    )

    render(
      <PublishButton
        entityKind="pilot"
        entityId="pilot-smoke-1"
        entityStore={makeEntityStore([fakePilot])}
        publishFn={publishFn}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish snapshot/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
    })

    const urlEl = screen.getByLabelText('Share URL')
    expect((urlEl as HTMLElement).textContent).toContain('smoke-abc')
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
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Scenario 9 — Read-only mode: Sheet readOnly=true → no PublishButton
// ---------------------------------------------------------------------------

describe('Smoke — readOnly mode', () => {
  test('Sheet with readOnly=true does NOT render the Share button', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-smoke-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
        readOnly={true}
      />
    )
    expect(screen.queryByRole('button', { name: /publish snapshot/i })).toBeNull()
  })

  test('Sheet with readOnly=false (default) renders the Share button', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-smoke-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByRole('button', { name: /publish snapshot/i })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Scenario 10 — Composition-mode badge per scenario
// ---------------------------------------------------------------------------

describe('Smoke — composition badge labels', () => {
  test('pilot-only → badge shows "Pilot"', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-smoke-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByLabelText('Composition mode: Pilot')).toBeTruthy()
  })

  test('mech-only → badge shows "Mech"', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-smoke-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByLabelText('Composition mode: Mech')).toBeTruthy()
  })

  test('crawler-only → badge shows "Crawler"', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-smoke-1"
        entityStore={makeEntityStore([fakeCrawler])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByLabelText('Composition mode: Crawler')).toBeTruthy()
  })

  test('wired (mech+pilot) → badge shows "Wired"', () => {
    const link = makeMechToPilotLink('mech-smoke-1', 'pilot-smoke-1')
    render(
      <Sheet
        kind="mech"
        id="mech-smoke-1"
        entityStore={makeEntityStore([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStore([link])}
      />
    )
    expect(screen.getByLabelText('Composition mode: Wired')).toBeTruthy()
  })
})
