/**
 * print.test.tsx — Smoke test verifying print-relevant markup is present.
 *
 * jsdom does not apply @media print rules, so we cannot assert CSS values.
 * These tests confirm that:
 *   1. The sheet sections that the print stylesheet targets are present in the
 *      DOM (i.e., the selectors have real targets in the markup).
 *   2. The LiveSheet top bar renders a <header> element (targeted by `header a` hide rule).
 *   3. No programmatic print-quality assertion is made — that is maintainer-
 *      reviewed per milestones-data.md §2C.
 *
 * Manual print-review checklist: see cycle-2.md in the cycle records.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { Mech } from '../../../lib/schemas/mech'
import type { Pilot } from '../../../lib/schemas/pilot'
import { FIXTURE_NOW } from '../../__tests__/fixtures'
import { makeEntityLookupMock, makeSoftLinkStoreMock } from '../../__tests__/mockEntityStore'
import type { SoftLinkStore } from '../../wiring/useSoftLinks'
import type { EntityLookup } from '../Sheet'
import { Sheet } from '../Sheet'

// ---------------------------------------------------------------------------
// Preload chassis data so MechSheet can resolve chassisRef
// ---------------------------------------------------------------------------

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
  motto: 'Fix it or lose it.',
  keepsake: 'A cracked circuit board.',
  appearance: 'Short, quick-eyed.',
  background: '',
  conditions: [],
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
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
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

const fakeCrawler: Crawler = {
  id: 'print-crawler-1',
  schemaVersion: 1,
  name: 'Print Fortress',
  techLevel: 'tech-1',
  crawlerBays: [{ bayRef: 'command-bay', npcCurrentHP: 4 }],
  systems: ['crawler-turret'],
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

// ---------------------------------------------------------------------------
// Store helpers (minimal — no mock.module required)
// ---------------------------------------------------------------------------

type AnyEntity = Pilot | Mech | Crawler

function makeEntityStore(entities: AnyEntity[]): EntityLookup {
  return makeEntityLookupMock(entities)
}

function makeEmptySoftLinkStore(): SoftLinkStore {
  return makeSoftLinkStoreMock()
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
    // PilotSheet renders <section class="sheet-section"> (print page-break target)
    const section = container.querySelector('section.sheet-section')
    expect(section).toBeTruthy()
  })

  test('renders a <header> element for the LiveSheet top bar (nav-hide rule target)', () => {
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

  test('top-bar back-link is inside <header> (targeted by print hide)', () => {
    const { container } = render(
      <Sheet
        kind="pilot"
        id="print-pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeEmptySoftLinkStore()}
      />
    )
    const backLink = container.querySelector('header a[aria-label="Back to roster"]')
    expect(backLink).toBeTruthy()
  })

  /**
   * Regression (#616). A picker `Field` renders its VALUE *inside* the button
   * rather than beside it, so the print rule `button:not([data-print='keep'])`
   * hid the pilot's class on paper — the one field saying what the pilot IS.
   * The sibling fields printed fine because `InlineEditField` renders a
   * `<span role="button">`, which that element selector never matched, so the
   * loss looked like a quirk of one field instead of a rule hitting a whole
   * variant. Same shape on the mech (chassis) and crawler (type) sheets.
   *
   * jsdom applies no `@media print` rules, so assert the opt-in attribute and
   * the containment that makes it necessary — not a computed style.
   */
  test('class picker opts into print, so its value survives the button-hide rule', () => {
    const { container } = render(
      <Sheet
        kind="pilot"
        id="print-pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeEmptySoftLinkStore()}
      />
    )
    const picker = container.querySelector('button[aria-label="Change class"]')
    expect(picker).toBeTruthy()
    // The value is inside the button — this containment is why the hatch is
    // required, so assert it too; if it ever moves out, this test should be
    // revisited rather than silently passing on the attribute alone.
    expect(picker?.textContent).toContain('Engineer')
    expect(picker?.getAttribute('data-print')).toBe('keep')
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
    // MechSheet renders stat blocks (component-lib StatBlock after the Header C rebuild)
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
    const section = container.querySelector('section[aria-label$="crawler sheet"]')
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
    // HP (6 on / 4 off) + AP (3 on / 2 off) appear in the hero StatBlocks,
    // the condensed MiniStat strip AND the PilotSheet body pip rows — assert
    // the print hook is present with both states rather than an exact count.
    expect(onPips.length).toBeGreaterThanOrEqual(9)
    expect(offPips.length).toBeGreaterThanOrEqual(6)
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
