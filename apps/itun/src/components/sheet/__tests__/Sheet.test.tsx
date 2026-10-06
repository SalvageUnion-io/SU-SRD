/**
 * Tests for Sheet.tsx — composition mode rendering.
 *
 * Uses dep-injection (no mock.module()) to supply fake entity stores and
 * softLink snapshots. All four composition modes + stand-in cases are covered.
 *
 * Pattern:
 *   1. Build a minimal entityStore snapshot via makeEntityLookupMock()
 *   2. Build a softLink snapshot via makeSoftLinkStoreMock()
 *   3. Render <Sheet kind={...} id={...} entityStore={...} softLinkStore={...} />
 *   4. Assert on text + aria labels
 *
 * Uses toBeTruthy() not toBeInTheDocument() (Wave 4 workaround).
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import {
  crawlerFixture,
  mechFixture,
  pilotFixture,
  softLinkFixture,
} from '../../__tests__/fixtures'
import { hydrateStores } from '../../__tests__/hydrateStores'
import { makeEntityLookupMock, makeSoftLinkStoreMock } from '../../__tests__/mockEntityStore'
import { Sheet } from '../Sheet'

beforeAll(hydrateStores)

// ---------------------------------------------------------------------------
// Shared fake data
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
// pilot-only mode
// ---------------------------------------------------------------------------

describe('Sheet — pilot-only (no links)', () => {
  test('renders PilotSheet content', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    // Pilot name appears in PilotSheet h2 alongside callsign — use partial match
    expect(screen.getAllByText(/Yara Voss/).length).toBeGreaterThan(0)
  })

  test('no stand-in rendered (pilot-only)', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    expect(screen.queryByText(/No pilot assigned/)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// mech-only mode
// ---------------------------------------------------------------------------

describe('Sheet — mech-only (no links)', () => {
  test('renders MechSheet content', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityLookupMock([fakeMech])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    // Name appears in the hero chip and condensed strip — use getAllByText
    expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0)
  })

  test('pilot RailEmpty appears in the "assigned pilot" slot', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityLookupMock([fakeMech])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    expect(screen.getByText(/No pilot assigned/)).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// crawler-only mode
// ---------------------------------------------------------------------------

describe('Sheet — crawler-only (no links)', () => {
  test('renders CrawlerSheet content', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-1"
        entityStore={makeEntityLookupMock([fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    // Name appears in the hero chip and condensed strip — use getAllByText
    expect(screen.getAllByText('Iron Tortoise').length).toBeGreaterThan(0)
  })

  test('the Pilots slot renders empty when no pilots are wired', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-1"
        entityStore={makeEntityLookupMock([fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    // The slot is "Pilots" now, not a single lead.
    expect(screen.getByText(/No pilots wired to this crawler/)).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// wired mode: mech + pilot link
// ---------------------------------------------------------------------------

describe('Sheet — wired (mech WITH pilot link)', () => {
  const mechToPilotLink = softLinkFixture('mech-to-pilot', 'mech-1', 'pilot-1')

  test('renders both PilotSheet and MechSheet', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityLookupMock([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([mechToPilotLink])}
      />
    )
    // Pilot name — PilotSheet h2 also includes callsign, use partial match
    expect(screen.getAllByText(/Yara Voss/).length).toBeGreaterThan(0)
    // Mech name — in the hero chip and condensed strip
    expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0)
  })

  test('pilot RailEmpty NOT rendered when pilot is wired', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityLookupMock([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([mechToPilotLink])}
      />
    )
    expect(screen.queryByText(/No pilot assigned/)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Mech RailEmpty: pilot-only mode
// ---------------------------------------------------------------------------

describe('Sheet — mech RailEmpty in pilot-only mode', () => {
  test('mech RailEmpty renders when pilot has no mech wired', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    expect(screen.getByText(/No mech assigned/)).toBeTruthy()
  })

  test('mech RailEmpty is ABSENT when a mech is wired', () => {
    const mechToPilotLink = softLinkFixture('mech-to-pilot', 'mech-1', 'pilot-1')
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeMech])}
        softLinkStore={makeSoftLinkStoreMock([mechToPilotLink])}
      />
    )
    expect(screen.queryByText(/No mech assigned/)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Mech RailEmpty: wired pilot+crawler (no mech)
// ---------------------------------------------------------------------------

describe('Sheet — mech RailEmpty in wired pilot+crawler (no mech)', () => {
  const pilotToCrawlerLink = softLinkFixture('pilot-to-crawler', 'pilot-1', 'crawler-1')

  test('mech RailEmpty renders when wired pilot+crawler but no mech', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([pilotToCrawlerLink])}
      />
    )
    expect(screen.getByText(/No mech assigned/)).toBeTruthy()
  })

  test('mech RailEmpty is ABSENT when mech is also wired (full wired)', () => {
    const mechToPilotLink = softLinkFixture('mech-to-pilot', 'mech-1', 'pilot-1')
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([mechToPilotLink, pilotToCrawlerLink])}
      />
    )
    expect(screen.queryByText(/No mech assigned/)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// ConditionToggle renders in editable sheet context
// ---------------------------------------------------------------------------

describe('Sheet — ConditionToggle renders in editable sheet context', () => {
  test('ConditionToggle renders in PilotSheet equipment list', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    // fakePilot has equipment: ['pistol'] — its condition cycles via the card
    // status badge (design §4.5)
    const toggle = screen.getByRole('button', { name: /status: intact/i })
    expect(toggle).toBeTruthy()
  })

  test('ConditionToggle renders in initial Intact state by default', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    // Equipment starts in Intact condition; ConditionToggle is interactive and persists to the store on change
    const toggles = screen.getAllByText('Intact')
    expect(toggles.length).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// readOnly propagation — stat cells non-interactive when Sheet readOnly=true
// ---------------------------------------------------------------------------

describe('Sheet — readOnly propagates to sub-sheets', () => {
  test('PilotSheet stat cells have no role=button when Sheet readOnly=true', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        readOnly
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    // InlineEditField renders role="button" only when NOT readOnly.
    // In a readOnly Sheet, stat cells should be plain spans with no button role.
    // ariaLabel for stat cells starts with "Edit " (InlineEditField).
    const statButtons = screen
      .queryAllByRole('button')
      .filter((el) => (el.getAttribute('aria-label') ?? '').startsWith('Edit '))
    expect(statButtons.length).toBe(0)
  })

  test('MechSheet stat cells have no role=button when Sheet readOnly=true', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        readOnly
        entityStore={makeEntityLookupMock([fakeMech])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    const statButtons = screen
      .queryAllByRole('button')
      .filter((el) => (el.getAttribute('aria-label') ?? '').startsWith('Edit '))
    expect(statButtons.length).toBe(0)
  })

  test('CrawlerSheet stat cells have no role=button when Sheet readOnly=true', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-1"
        readOnly
        entityStore={makeEntityLookupMock([fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    const statButtons = screen
      .queryAllByRole('button')
      .filter((el) => (el.getAttribute('aria-label') ?? '').startsWith('Edit '))
    expect(statButtons.length).toBe(0)
  })

  test('stat cells ARE interactive (role=button) when Sheet is NOT readOnly', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    // Without readOnly, InlineEditField renders role="button" on the value span
    // ariaLabel starts with "Edit " (InlineEditField)
    const statButtons = screen
      .queryAllByRole('button')
      .filter((el) => (el.getAttribute('aria-label') ?? '').startsWith('Edit '))
    expect(statButtons.length).toBeGreaterThan(0)
  })
})
