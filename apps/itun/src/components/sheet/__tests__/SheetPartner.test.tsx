/**
 * The partner sheet.
 *
 * The two things worth pinning are the ones that follow from partners NOT being
 * store entities:
 *   - writes go through the HOST's `partners` array, since a partner has no row
 *     of its own; and
 *   - a pilot-granted partner's ceilings come from the Union Crawler, so the
 *     same partner renders different maxima depending on a link two hops away.
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { fireEvent } from '@testing-library/react'

import { SheetPartner } from '../SheetPartner'
import { findPartner, replacePartner } from '../../../lib/partnerLookup'
import type { Mech } from '../../../lib/schemas/mech'
import type { PartnerInstance } from '../../../lib/schemas/partner'
import type { Pilot } from '../../../lib/schemas/pilot'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

const now = new Date().toISOString()

const partner = (over: Partial<PartnerInstance> = {}): PartnerInstance => ({
  id: 'p1',
  hostRef: 'survey-drone',
  hostSchema: 'equipment',
  systems: [],
  modules: [],
  conditions: [],
  ...over,
})

const pilot = (partners: PartnerInstance[]): Pilot => ({
  id: 'pilot-1',
  schemaVersion: 1,
  name: 'Caligula',
  callsign: 'Emperor',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  conditions: [],
  partners,
  createdAt: now,
  updatedAt: now,
})

const mech = (partners: PartnerInstance[]): Mech => ({
  id: 'mech-1',
  schemaVersion: 1,
  name: 'Damnatio Memoriae',
  chassisRef: 'little-sestra',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  partners,
  createdAt: now,
  updatedAt: now,
})

describe('findPartner', () => {
  test('finds a partner on a pilot, with its host', () => {
    const host = pilot([partner()])
    const found = findPartner([host], [], 'p1')
    expect(found?.hostKind).toBe('pilot')
    expect(found?.host.id).toBe('pilot-1')
  })

  test('finds a partner on a mech too — both hosts are scanned', () => {
    const found = findPartner([], [mech([partner({ id: 'p9' })])], 'p9')
    expect(found?.hostKind).toBe('mech')
  })

  test('returns null when no host claims the id', () => {
    expect(findPartner([pilot([])], [mech([])], 'nope')).toBeNull()
  })
})

describe('replacePartner', () => {
  test('patches only the matching partner', () => {
    const next = replacePartner([partner({ id: 'a' }), partner({ id: 'b' })], 'b', { name: 'Rek' })
    expect(next[0]?.name).toBeUndefined()
    expect(next[1]?.name).toBe('Rek')
  })

  test('a write to a partner that no longer exists is a no-op, not an append', () => {
    const next = replacePartner([partner({ id: 'a' })], 'ghost', { name: 'Nope' })
    expect(next).toHaveLength(1)
    expect(next[0]?.id).toBe('a')
  })
})

describe('SheetPartner', () => {
  test('renders the partner name and its stat block as the role', () => {
    const host = pilot([partner({ name: 'Custos' })])
    render(<SheetPartner found={findPartner([host], [], 'p1')!} readOnly />)
    expect(screen.getAllByText('Custos').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Survey Drone').length).toBeGreaterThan(0)
  })

  test('links back to the owning host — the only navigation a partner has', () => {
    const host = pilot([partner()])
    render(<SheetPartner found={findPartner([host], [], 'p1')!} readOnly />)
    const up = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === '/sheet/pilot/pilot-1')
    expect(up.length).toBeGreaterThan(0)
  })

  test('a pilot-granted partner takes its ceilings from the linked crawler', () => {
    const host = pilot([partner()])
    const crawler = {
      id: 'c1',
      schemaVersion: 1 as const,
      name: 'Haven',
      techLevel: 'tech-3',
      systems: [],
      createdAt: now,
      updatedAt: now,
    }
    render(<SheetPartner found={findPartner([host], [], 'p1')!} crawler={crawler} readOnly />)
    // Survey Drone at Tech 3: SP 2 + 2*2 = 6, and the tech level itself shows 3.
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\b6\b/).length).toBeGreaterThan(0)
  })

  test('a mech-granted drone ignores the crawler entirely', () => {
    const host = mech([partner({ id: 'p1', hostRef: 'sestra-drone', hostSchema: 'drones' })])
    render(<SheetPartner found={findPartner([], [host], 'p1')!} readOnly />)
    expect(screen.getAllByText('Sestra Drone').length).toBeGreaterThan(0)
    // Fixed at Tech 3 with SP 7 — no crawler was supplied and none is consulted.
    expect(screen.getAllByText(/\b7\b/).length).toBeGreaterThan(0)
  })

  test('installed systems render as item cards', () => {
    const host = pilot([partner({ systems: ['high-gain-antenna'] })])
    render(<SheetPartner found={findPartner([host], [], 'p1')!} readOnly />)
    expect(screen.queryByText(/No systems installed/i)).toBeNull()
  })

  test('an empty loadout says so rather than rendering a blank slab', () => {
    const host = pilot([partner()])
    render(<SheetPartner found={findPartner([host], [], 'p1')!} readOnly />)
    expect(screen.getByText(/No systems installed/i)).toBeTruthy()
    expect(screen.getByText(/No modules installed/i)).toBeTruthy()
  })
})

describe('SheetPartner — the Hold', () => {
  test('a partner with cargo capacity gets a hold', () => {
    // Survey Drone carries 1 at Tech 1.
    const host = pilot([partner()])
    render(<SheetPartner found={findPartner([host], [], 'p1')!} readOnly />)
    expect(screen.getByText(/The Hold/i)).toBeTruthy()
    expect(screen.getByText(/Nothing carried/i)).toBeTruthy()
  })

  test('an Immobile zero-cargo partner has NO hold at all, not an empty one', () => {
    // Auto-Turret: cargoCapacity 0 + Immobile. A 0/0 hold would invite a
    // player to try loading something into a thing that cannot carry.
    const host = pilot([partner({ hostRef: 'auto-turret' })])
    render(<SheetPartner found={findPartner([host], [], 'p1')!} readOnly />)
    expect(screen.queryByText(/The Hold/i)).toBeNull()
  })

  test('the Storage Bay side appears only when a crawler is linked', () => {
    const host = pilot([partner()])
    render(<SheetPartner found={findPartner([host], [], 'p1')!} readOnly />)
    expect(screen.queryByText(/Storage Bay/i)).toBeNull()
  })
})

describe('SheetPartner — item condition', () => {
  /**
   * Repair and the status badge are DIFFERENT verbs and were briefly the same
   * function: `onRepair` was wired to the Intact→Damaged→Destroyed cycle, so
   * repairing a Damaged item destroyed it. That is data loss dressed as a fix,
   * and nothing in the type system objects — both are `() => void`.
   */
  test('Repair sets Intact; it does not advance the damage cycle', () => {
    const updates: Array<Record<string, unknown>> = []
    const fakeStore = (() => ({
      update: (_t: string, _id: string, fields: Record<string, unknown>) => {
        updates.push(fields)
        return Promise.resolve()
      },
      transfer: () => Promise.resolve(),
      list: () => [],
      softLinks: [],
    })) as unknown as typeof import('../../../stores/entityStore').useEntityStore

    const host = pilot([
      partner({
        systems: ['high-gain-antenna'],
        systemConditions: { 'high-gain-antenna': 'damaged' },
      }),
    ])
    render(<SheetPartner found={findPartner([host], [], 'p1')!} store={fakeStore} />)

    // Opens the confirm modal…
    fireEvent.click(screen.getByRole('button', { name: /^Repair High Gain Antenna$/i }))
    // …and confirm WITHOUT deducting: a partner has no crawler scrap pool
    // wired, so the deduct button is disabled. Per the rules a partner
    // restores in a Mech Bay during Downtime rather than from the pool here.
    fireEvent.click(screen.getByRole('button', { name: /without deducting/i }))

    const written = updates
      .flatMap((u) =>
        Array.isArray(u.partners) ? (u.partners as Array<Record<string, unknown>>) : []
      )
      .map((p) => (p.systemConditions as Record<string, string> | undefined)?.['high-gain-antenna'])
      .filter(Boolean)

    expect(written.length).toBeGreaterThan(0)
    // The whole point: never 'destroyed'.
    expect(written).not.toContain('destroyed')
    expect(written).toContain('intact')
  })
})
