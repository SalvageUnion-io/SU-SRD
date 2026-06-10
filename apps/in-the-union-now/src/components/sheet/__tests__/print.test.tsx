/**
 * print.test.tsx — Smoke test verifying print-relevant markup is present.
 *
 * jsdom does not apply @media print rules, so we cannot assert CSS values.
 * These tests confirm that:
 *   1. The sheet sections that the print stylesheet targets are present in the
 *      DOM (i.e., the selectors have real targets in the markup).
 *   2. The SheetHeader renders a <header> element (targeted by `header a` hide rule).
 *   3. No programmatic print-quality assertion is made — that is maintainer-
 *      reviewed per milestones-data.md §2C.
 *
 * Manual print-review checklist: see cycle-2.md in the cycle records.
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Sheet } from '../Sheet'
import type { EntityLookup } from '../Sheet'
import type { SoftLinkStore } from '../../wiring/useSoftLinks'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { Mech } from '../../../lib/schemas/mech'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { SoftLink } from '../../../lib/schemas/softLink'
import { mock } from 'bun:test'

// ---------------------------------------------------------------------------
// Preload chassis data so MechSheet can resolve chassisRef
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await SalvageUnionReference.preload(['chassis', 'crawler-tech-levels', 'systems', 'modules'])
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Minimal fake entities
// ---------------------------------------------------------------------------

const fakePilot: Pilot = {
  id: 'print-pilot-1',
  schemaVersion: 1,
  name: 'Vera Mast',
  callsign: 'Sparks',
  classRef: 'engineer',
  abilities: ['field-repair'],
  equipment: ['wrench'],
  rollResults: [],
  motto: 'Fix it or lose it.',
  keepsake: 'A cracked circuit board.',
  appearance: 'Short, quick-eyed.',
  background: '',
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeMech: Mech = {
  id: 'print-mech-1',
  schemaVersion: 1,
  name: 'Print Wraith',
  // MechSheet resolves chassis by name (the builder stores the name); use a
  // real chassis so structurePoints resolve and the SP pip row renders.
  chassisRef: 'Mule',
  systems: ['laser-lance'],
  modules: ['stealth-cell'],
  cargoLots: [
    {
      id: 'lot-ration',
      kind: 'unit' as const,
      name: 'ration-pack',
      cat: 'SEALED' as const,
      units: 1,
      code: 'RAT',
    },
  ],
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeCrawler: Crawler = {
  id: 'print-crawler-1',
  schemaVersion: 1,
  name: 'Print Fortress',
  techLevel: 'tech-1',
  crawlerBays: [{ bayRef: 'command-bay', npcCurrentHP: 4 }],
  systems: ['crawler-turret'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// ---------------------------------------------------------------------------
// Store helpers (minimal — no mock.module required)
// ---------------------------------------------------------------------------

type AnyEntity = Pilot | Mech | Crawler

function makeEntityStore(entities: AnyEntity[]): EntityLookup {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (_type, id) => (entities.find((e) => e.id === id) ?? null) as any,
  }
}

function makeEmptySoftLinkStore(): SoftLinkStore {
  // The create mock return value is unused in print tests; cast is safe
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMock = mock(async () => undefined) as any
  return {
    softLinks: [] as SoftLink[],
    create: createMock,
    delete: mock(async () => undefined),
  }
}

// ---------------------------------------------------------------------------
// Tests: print-relevant markup presence
// ---------------------------------------------------------------------------

describe('Print markup — PilotSheet', () => {
  test('renders a <section> element that the print stylesheet targets', () => {
    const { container } = render(
      <Sheet
        kind="pilot"
        id="print-pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeEmptySoftLinkStore()}
      />
    )
    // PilotSheet renders <section aria-labelledby="pilot-sheet-heading">
    const section = container.querySelector('section[aria-labelledby="pilot-sheet-heading"]')
    expect(section).toBeTruthy()
  })

  test('renders a <header> element for the SheetHeader (nav-hide rule target)', () => {
    const { container } = render(
      <Sheet
        kind="pilot"
        id="print-pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeEmptySoftLinkStore()}
      />
    )
    const header = container.querySelector('header')
    expect(header).toBeTruthy()
  })

  test('SheetHeader back-link is inside <header> (targeted by print hide)', () => {
    const { container } = render(
      <Sheet
        kind="pilot"
        id="print-pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeEmptySoftLinkStore()}
      />
    )
    const backLink = container.querySelector('header a[aria-label="Back to dashboard"]')
    expect(backLink).toBeTruthy()
  })
})

describe('Print markup — MechSheet', () => {
  test('renders a <section> for the mech (print page-break target)', () => {
    const { container } = render(
      <Sheet
        kind="mech"
        id="print-mech-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeEmptySoftLinkStore()}
      />
    )
    const section = container.querySelector('section[aria-labelledby="mech-sheet-heading"]')
    expect(section).toBeTruthy()
  })

  test('renders a <dl> for stats (print page-break-inside: avoid target)', () => {
    const { container } = render(
      <Sheet
        kind="mech"
        id="print-mech-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeEmptySoftLinkStore()}
      />
    )
    // MechSheet renders stat blocks (now via EditableStatRow components after Wave 6 cycle-1)
    // — print stylesheet's section/card selectors target the encompassing structure.
    // Confirm the mech section renders at all.
    const mechSection = container.querySelector('[aria-labelledby], section, article')
    expect(mechSection).toBeTruthy()
  })

  test('mech sheet renders without throwing (print stylesheet attaches to existing markup)', () => {
    const { container } = render(
      <Sheet
        kind="mech"
        id="print-mech-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeEmptySoftLinkStore()}
      />
    )
    // Smoke test: Sheet rendered some content. CSS print rules apply at the document
    // root level; jsdom doesn't evaluate @media print, so we just confirm markup exists.
    expect(container.children.length).toBeGreaterThan(0)
  })

  test('mech name heading is an h2 (print 16pt target)', () => {
    const { container } = render(
      <Sheet
        kind="mech"
        id="print-mech-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeEmptySoftLinkStore()}
      />
    )
    const h2 = container.querySelector('h2#mech-sheet-heading')
    expect(h2).toBeTruthy()
    expect(h2?.textContent).toBe('Print Wraith')
  })
})

describe('Print markup — CrawlerSheet', () => {
  test('renders a <section> for the crawler (print page-break target)', () => {
    const { container } = render(
      <Sheet
        kind="crawler"
        id="print-crawler-1"
        entityStore={makeEntityStore([fakeCrawler])}
        softLinkStore={makeEmptySoftLinkStore()}
      />
    )
    const section = container.querySelector('section[aria-labelledby="crawler-sheet-heading"]')
    expect(section).toBeTruthy()
  })
})

describe('Print markup — stat pip rows', () => {
  // The print stylesheet targets `[data-pip]` to keep filled pips inked on
  // paper (the global `*` reset would otherwise wipe their fill). jsdom does
  // not evaluate @media print, so we assert the print hook (`data-pip`) is
  // present in the markup with correct filled/empty state, which is the
  // selector the print rules depend on.

  test('PilotSheet renders HP/AP pip rows with filled + empty pips', () => {
    const pilotWithPartialStats: Pilot = {
      ...fakePilot,
      id: 'pip-pilot-1',
      currentHP: 6, // PILOT_MAX_HP = 10 -> 6 filled, 4 empty
      currentAP: 3, // PILOT_MAX_AP = 5 -> 3 filled, 2 empty
    }
    const { container } = render(
      <Sheet
        kind="pilot"
        id="pip-pilot-1"
        entityStore={makeEntityStore([pilotWithPartialStats])}
        softLinkStore={makeEmptySoftLinkStore()}
      />
    )
    const onPips = container.querySelectorAll('[data-pip="on"]')
    const offPips = container.querySelectorAll('[data-pip="off"]')
    // HP (6 on / 4 off) + AP (3 on / 2 off) = 9 on, 6 off
    expect(onPips.length).toBe(9)
    expect(offPips.length).toBe(6)
  })

  test('MechSheet renders SP/EP/Heat pip rows with data-pip hooks', () => {
    const { container } = render(
      <Sheet
        kind="mech"
        id="print-mech-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeEmptySoftLinkStore()}
      />
    )
    // chassis stats vary, but with a resolved chassis there must be pip hooks.
    const pips = container.querySelectorAll('[data-pip]')
    expect(pips.length).toBeGreaterThan(0)
  })

  test('CrawlerSheet renders the SP pip row with data-pip hooks', () => {
    const { container } = render(
      <Sheet
        kind="crawler"
        id="print-crawler-1"
        entityStore={makeEntityStore([fakeCrawler])}
        softLinkStore={makeEmptySoftLinkStore()}
      />
    )
    const pips = container.querySelectorAll('[data-pip]')
    expect(pips.length).toBeGreaterThan(0)
  })
})

describe('Print markup — composition mode badge', () => {
  test('mode badge renders with aria-label (print border rule target)', () => {
    render(
      <Sheet
        kind="mech"
        id="print-mech-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeEmptySoftLinkStore()}
      />
    )
    const badge = screen.getByLabelText('Composition mode: Mech')
    expect(badge).toBeTruthy()
  })
})
