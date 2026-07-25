/**
 * Plan 4.8 integration surface — top-bar actions + mobile segment switch.
 *
 *   - NO sheet has a global top-bar Edit toggle (redesign: unified edit
 *     language — editing is per-section; each Identity panel owns its own
 *     Edit button).
 *   - The segmented Pilot/Mech/Crawler switch (design §3.7) renders only on
 *     wired compositions: one segment per present counterpart, the viewed
 *     kind marked active (aria-current, rust fill), the others linking to
 *     their wired counterpart's sheet.
 *
 * Rendered without a RouterProvider — AppLink degrades to plain anchors, so
 * hrefs are asserted directly.
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
import { makeEntityLookupMock, makeSoftLinkStoreMock } from '../../__tests__/mockEntityStore'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

const fakePilot: Pilot = {
  id: 'pilot-1',
  schemaVersion: 1,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
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
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeCrawler: Crawler = {
  id: 'crawler-1',
  schemaVersion: 1,
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  systems: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

type AnyEntity = Pilot | Mech | Crawler

function makeEntityStore(entities: AnyEntity[]): EntityLookup {
  return makeEntityLookupMock(entities)
}

function makeSoftLinkStore(links: SoftLink[]): SoftLinkStore {
  // The create mock is unused here; cast is safe — these tests never assign()
  return makeSoftLinkStoreMock(links)
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

const mechToPilot = makeLink('link-1', 'mech', 'mech-1', 'pilot', 'pilot-1', 'mech-to-pilot')
const pilotToCrawler = makeLink(
  'link-2',
  'pilot',
  'pilot-1',
  'crawler',
  'crawler-1',
  'pilot-to-crawler'
)

// ---------------------------------------------------------------------------
// Top-bar Edit action
// ---------------------------------------------------------------------------

describe('Sheet — top-bar Edit action', () => {
  test('pilot sheet has NO Edit toggle — fields are click-to-edit', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    // Unified edit language: no global build-edit mode on the pilot sheet, and
    // no per-section one either — fields are edited by clicking the field.
    expect(screen.queryByRole('button', { name: /edit this pilot/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /edit identity/i })).toBeNull()
  })

  test('identity fields are click-to-edit with no toggle to unlock first', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    // No gate: the field is its own affordance from the first render. (It used
    // to take a section "Edit identity" toggle to reveal these.)
    expect(screen.getByRole('button', { name: /edit callsign/i })).toBeTruthy()
    // Class is picker-backed: its affordance opens the shared picker modal, so
    // its accessible name matches the visible 'Change' word (WCAG 2.5.3).
    expect(screen.getByRole('button', { name: /change class/i })).toBeTruthy()
  })

  test('mech sheet has NO Edit toggle — fields are click-to-edit', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.queryByRole('button', { name: /edit this mech/i })).toBeNull()
    // No per-section toggle either — fields are edited by clicking the field.
    expect(screen.queryByRole('button', { name: /edit identity/i })).toBeNull()
  })

  test('crawler sheet has NO Edit toggle — fields are click-to-edit', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-1"
        entityStore={makeEntityStore([fakeCrawler])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.queryByRole('button', { name: /edit this crawler/i })).toBeNull()
    // No per-section toggle either — fields are edited by clicking the field.
    expect(screen.queryByRole('button', { name: /edit identity/i })).toBeNull()
  })

  test('readOnly hides Edit (and Share)', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
        readOnly
      />
    )
    expect(screen.queryByRole('button', { name: /edit this pilot/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /edit identity/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /share/i })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Mobile segment switch (design §3.7)
// ---------------------------------------------------------------------------

describe('Sheet — mobile segment switch', () => {
  test('absent on unwired sheets', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.queryByRole('navigation', { name: /wired sheets/i })).toBeNull()
  })

  test('fully wired pilot sheet: active Pilot segment + Mech/Crawler links', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([mechToPilot, pilotToCrawler])}
      />
    )
    const nav = screen.getByRole('navigation', { name: /wired sheets/i })
    expect(nav).toBeTruthy()
    // mobile-only row, stitched into the sticky bar
    expect(nav.className).toContain('sm:hidden')

    // Active segment = the viewed kind: rust fill, aria-current, not a link.
    const active = nav.querySelector('[aria-current="page"]')
    expect(active?.textContent).toBe('Pilot')
    expect(active?.className).toContain('bg-rust')
    expect(active?.tagName).not.toBe('A')

    // The other segments navigate to the wired counterparts' sheets.
    const links = Array.from(nav.querySelectorAll('a')).map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ])
    expect(links).toEqual([
      ['Mech', '/sheet/mech/mech-1'],
      ['Crawler', '/sheet/crawler/crawler-1'],
    ])
  })

  test('wired mech sheet marks Mech active', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityStore([fakePilot, fakeMech])}
        softLinkStore={makeSoftLinkStore([mechToPilot])}
      />
    )
    const nav = screen.getByRole('navigation', { name: /wired sheets/i })
    const active = nav.querySelector('[aria-current="page"]')
    expect(active?.textContent).toBe('Mech')
    const links = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(links).toEqual(['/sheet/pilot/pilot-1'])
  })
})
