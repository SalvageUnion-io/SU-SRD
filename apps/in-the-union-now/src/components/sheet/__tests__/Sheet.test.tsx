/**
 * Tests for Sheet.tsx — composition mode rendering.
 *
 * Uses dep-injection (no mock.module()) to supply fake entity stores and
 * softLink snapshots. All four composition modes + stand-in cases are covered.
 *
 * Pattern:
 *   1. Build a minimal entityStore snapshot via makeEntityStore()
 *   2. Build a softLink snapshot via makeSoftLinkStore()
 *   3. Render <Sheet kind={...} id={...} entityStore={...} softLinkStore={...} />
 *   4. Assert on text + aria labels
 *
 * Uses toBeTruthy() not toBeInTheDocument() (Wave 4 workaround).
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Sheet } from '../Sheet'
import type { EntityLookup } from '../Sheet'
import type { SoftLinkStore } from '../../wiring/useSoftLinks'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { Mech } from '../../../lib/schemas/mech'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { SoftLink } from '../../../lib/schemas/softLink'

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
// Shared fake data
// ---------------------------------------------------------------------------

const fakePilot: Pilot = {
  id: 'pilot-1',
  schemaVersion: 1,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: ['scavenge'],
  equipment: ['pistol'],
  rollResults: [],
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
  cargo: ['med-kit'],
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeCrawler: Crawler = {
  id: 'crawler-1',
  schemaVersion: 1,
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  bays: ['bay-1'],
  systems: ['hull-repair'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// ---------------------------------------------------------------------------
// Store factories
// ---------------------------------------------------------------------------

type AnyEntity = Pilot | Mech | Crawler

function makeEntityStore(entities: AnyEntity[]): EntityLookup {
  return {
    get: (_type, id) => {
      // EntityLookup's conditional return type can't be satisfied without a cast
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (entities.find((e) => e.id === id) ?? null) as any
    },
  }
}

function makeSoftLinkStore(links: SoftLink[]): SoftLinkStore {
  // The create mock is unused in Sheet tests; cast is safe — Sheet never calls assign()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMock = mock(async () => links[0]) as any
  return {
    softLinks: links,
    create: createMock,
    delete: mock(async () => undefined),
  }
}

function makeLink(
  id: string,
  fromType: 'mech' | 'pilot' | 'crawler',
  fromId: string,
  toType: 'mech' | 'pilot' | 'crawler',
  toId: string,
  type: SoftLink['type']
): SoftLink {
  return {
    id,
    from: { type: fromType, id: fromId },
    to: { type: toType, id: toId },
    type,
    createdAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// pilot-only mode
// ---------------------------------------------------------------------------

describe('Sheet — pilot-only (no links)', () => {
  test('renders PilotSheet content', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    // Pilot name appears in PilotSheet h2 alongside callsign — use partial match
    expect(screen.getAllByText(/Yara Voss/).length).toBeGreaterThan(0)
  })

  test('composition badge shows pilot mode', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByLabelText('Composition mode: Pilot')).toBeTruthy()
  })

  test('no stand-in rendered (pilot-only)', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.queryByLabelText('No pilot assigned')).toBeNull()
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
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    // Name appears in SheetHeader (h1) and MechSheet (h2) — use getAllByText
    expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0)
  })

  test('composition badge shows mech mode', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByLabelText('Composition mode: Mech')).toBeTruthy()
  })

  test('PilotStandIn appears in "assigned pilot" slot', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByLabelText('No pilot assigned')).toBeTruthy()
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
        entityStore={makeEntityStore([fakeCrawler])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    // Name appears in SheetHeader (h1) and CrawlerSheet (h2) — use getAllByText
    expect(screen.getAllByText('Iron Tortoise').length).toBeGreaterThan(0)
  })

  test('composition badge shows crawler mode', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-1"
        entityStore={makeEntityStore([fakeCrawler])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByLabelText('Composition mode: Crawler')).toBeTruthy()
  })

  test('CrawlerPilotsStandIn appears when no pilots wired', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-1"
        entityStore={makeEntityStore([fakeCrawler])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByLabelText('No pilots assigned')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// wired mode: mech + pilot link
// ---------------------------------------------------------------------------

describe('Sheet — wired (mech WITH pilot link)', () => {
  const mechToPilotLink = makeLink('link-1', 'mech', 'mech-1', 'pilot', 'pilot-1', 'mech-to-pilot')

  test('renders both PilotSheet and MechSheet', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityStore([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStore([mechToPilotLink])}
      />
    )
    // Pilot name — PilotSheet h2 also includes callsign, use partial match
    expect(screen.getAllByText(/Yara Voss/).length).toBeGreaterThan(0)
    // Mech name — in SheetHeader (h1) and MechSheet (h2)
    expect(screen.getAllByText('Iron Fist').length).toBeGreaterThan(0)
  })

  test('composition badge shows wired mode', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityStore([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStore([mechToPilotLink])}
      />
    )
    expect(screen.getByLabelText('Composition mode: Wired')).toBeTruthy()
  })

  test('PilotStandIn NOT rendered when pilot is wired', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityStore([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStore([mechToPilotLink])}
      />
    )
    expect(screen.queryByLabelText('No pilot assigned')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// MechStandIn: pilot-only mode
// ---------------------------------------------------------------------------

describe('Sheet — MechStandIn in pilot-only mode', () => {
  test('MechStandIn renders when pilot has no mech wired', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByLabelText('No mech assigned')).toBeTruthy()
  })

  test('MechStandIn is ABSENT when a mech is wired', () => {
    const mechToPilotLink = makeLink(
      'link-1',
      'mech',
      'mech-1',
      'pilot',
      'pilot-1',
      'mech-to-pilot'
    )
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot, fakeMech])}
        softLinkStore={makeSoftLinkStore([mechToPilotLink])}
      />
    )
    expect(screen.queryByLabelText('No mech assigned')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// MechStandIn: wired pilot+crawler (no mech)
// ---------------------------------------------------------------------------

describe('Sheet — MechStandIn in wired pilot+crawler (no mech)', () => {
  const pilotToCrawlerLink = makeLink(
    'link-2',
    'pilot',
    'pilot-1',
    'crawler',
    'crawler-1',
    'pilot-to-crawler'
  )

  test('MechStandIn renders when wired pilot+crawler but no mech', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([pilotToCrawlerLink])}
      />
    )
    expect(screen.getByLabelText('No mech assigned')).toBeTruthy()
  })

  test('MechStandIn is ABSENT when mech is also wired (full wired)', () => {
    const mechToPilotLink = makeLink(
      'link-1',
      'mech',
      'mech-1',
      'pilot',
      'pilot-1',
      'mech-to-pilot'
    )
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([mechToPilotLink, pilotToCrawlerLink])}
      />
    )
    expect(screen.queryByLabelText('No mech assigned')).toBeNull()
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
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    // fakePilot has equipment: ['pistol'], so a ConditionToggle with ariaLabelPrefix "pistol" renders
    const toggle = screen.getByRole('button', { name: /pistol condition/i })
    expect(toggle).toBeTruthy()
  })

  test('ConditionToggle renders in initial Intact state by default', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
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
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    // InlineEditField renders role="button" only when NOT readOnly.
    // In a readOnly Sheet, stat cells should be plain spans with no button role.
    // ariaLabel for stat cells is "Edit " (empty label string from EditableStatRow).
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
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeSoftLinkStore([])}
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
        entityStore={makeEntityStore([fakeCrawler])}
        softLinkStore={makeSoftLinkStore([])}
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
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    // Without readOnly, InlineEditField renders role="button" on the value span
    // ariaLabel is "Edit " (EditableStatRow passes label="" to EditableStatRow)
    const statButtons = screen
      .queryAllByRole('button')
      .filter((el) => (el.getAttribute('aria-label') ?? '').startsWith('Edit '))
    expect(statButtons.length).toBeGreaterThan(0)
  })
})
