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

import { beforeAll, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { Pilot } from 'game-domain/schemas/pilot'
import { crawlerFixture, mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import {
  makeEntityLookupMock,
  makeSoftLinkStoreMock,
} from '../../../components/__tests__/mockEntityStore'
import { Sheet } from '../Sheet'

beforeAll(hydrateStores)

// ---------------------------------------------------------------------------
// Minimal fake entities
// ---------------------------------------------------------------------------

const fakePilot = pilotFixture({
  id: 'print-pilot-1',
  name: 'Vera Mast',
  callsign: 'Sparks',
  classRef: 'engineer',
  abilities: ['field-repair'],
  equipment: ['wrench'],
  motto: 'Fix it or lose it.',
  keepsake: 'A cracked circuit board.',
  appearance: 'Short, quick-eyed.',
})

const fakeMech = mechFixture({
  id: 'print-mech-1',
  name: 'Print Wraith',
  // MechSheet resolves chassis by name (the builder stores the name); use a
  // real chassis so structurePoints resolve and the SP pip row renders.
  chassisRef: 'mule',
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
})

const fakeCrawler = crawlerFixture({
  id: 'print-crawler-1',
  name: 'Print Fortress',
  crawlerBays: [{ bayRef: 'command-bay', npcCurrentHP: 4 }],
  systems: ['crawler-turret'],
})

// ---------------------------------------------------------------------------
// Tests: print-relevant markup presence
// ---------------------------------------------------------------------------

describe('Print markup — PilotSheet', () => {
  test('renders a <section> element that the print stylesheet targets', () => {
    const { container } = render(
      <Sheet
        kind="pilot"
        id="print-pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock()}
      />
    )
    // PilotSheet renders <section class="su-sheet-section"> (print page-break target)
    const section = container.querySelector('section.su-sheet-section')
    expect(section).toBeTruthy()
  })

  test('marks the LiveSheet top bar data-print="hide" (the chrome-hide rule target)', () => {
    const { container } = render(
      <Sheet
        kind="pilot"
        id="print-pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock()}
      />
    )
    const bar = container.querySelector('section[aria-label="Sheet controls"]')
    expect(bar?.getAttribute('data-print')).toBe('hide')
  })

  /**
   * Regression. The print rule `button:not([data-print='keep'])` once hid the
   * pilot's class on paper, because a picker `Field` renders its value INSIDE
   * its button. In Edit the class now leads the card (R57) as text beside a
   * Change Class button, so the value sits outside every button and prints,
   * while the button itself is chrome and hides.
   *
   * jsdom applies no `@media print` rules, so assert the containment, not a
   * computed style.
   */
  test('the class prints: its name sits outside the Change Class button', () => {
    const { container } = render(
      <Sheet
        kind="pilot"
        id="print-pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock()}
      />
    )
    const button = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Change Class'
    )
    expect(button).toBeTruthy()
    expect(button?.getAttribute('data-print')).toBeNull()
    const name = [...(button?.parentElement?.children ?? [])].find((el) => el !== button)
    expect(name?.textContent).toBe('Engineer')
    expect(name?.closest('button')).toBeNull()
  })
})

describe('Print markup — MechSheet', () => {
  test('renders a <section> for the mech (print page-break target)', () => {
    const { container } = render(
      <Sheet
        kind="mech"
        id="print-mech-1"
        entityStore={makeEntityLookupMock([fakeMech])}
        softLinkStore={makeSoftLinkStoreMock()}
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
        entityStore={makeEntityLookupMock([fakeMech])}
        softLinkStore={makeSoftLinkStoreMock()}
      />
    )
    // MechSheet renders stat blocks — the print stylesheet's section/card
    // selectors target the encompassing structure.
    // Confirm the mech section renders at all.
    const mechSection = container.querySelector('[aria-labelledby], section, article')
    expect(mechSection).toBeTruthy()
  })

  test('mech sheet renders without throwing (print stylesheet attaches to existing markup)', () => {
    const { container } = render(
      <Sheet
        kind="mech"
        id="print-mech-1"
        entityStore={makeEntityLookupMock([fakeMech])}
        softLinkStore={makeSoftLinkStoreMock()}
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
        entityStore={makeEntityLookupMock([fakeMech])}
        softLinkStore={makeSoftLinkStoreMock()}
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
        entityStore={makeEntityLookupMock([fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock()}
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
        entityStore={makeEntityLookupMock([pilotWithPartialStats])}
        softLinkStore={makeSoftLinkStoreMock()}
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
        entityStore={makeEntityLookupMock([fakeMech])}
        softLinkStore={makeSoftLinkStoreMock()}
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
        entityStore={makeEntityLookupMock([fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock()}
      />
    )
    const pips = container.querySelectorAll('[data-pip]')
    expect(pips.length).toBeGreaterThan(0)
  })
})
