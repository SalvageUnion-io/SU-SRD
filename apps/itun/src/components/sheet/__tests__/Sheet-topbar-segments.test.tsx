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

// `hidden: true` on the top-bar queries: the sticky bar is aria-hidden until
// the first row scrolls away, and happy-dom never fires the observer that flips
// it. These assertions are about what the bar CONTAINS, not whether it is on
// screen at rest.
import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
  test('pilot sheet has NO global Edit toggle — editing is per-section', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    // Unified edit language: no global build-edit mode on the pilot sheet.
    expect(screen.queryByRole('button', { name: /edit this pilot/i, hidden: true })).toBeNull()
    // The Identity FIELD section owns its own Edit button instead.
    const sectionEdit = screen.getByRole('button', { name: /edit identity/i, hidden: true })
    expect(sectionEdit.getAttribute('aria-pressed')).toBe('false')
  })

  test('Identity section Edit flips only that section into inline-edit', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    // Read-only by default: no inline click-to-edit fields are exposed.
    expect(screen.queryByRole('button', { name: /edit callsign/i, hidden: true })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /edit identity/i, hidden: true }))

    // Toggling on relabels the control and reveals the section's inline fields.
    const on = screen.getByRole('button', { name: /done editing identity/i, hidden: true })
    expect(on.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /edit callsign/i, hidden: true })).toBeTruthy()
    // Class is picker-backed: its affordance opens the shared picker modal, so
    // its accessible name matches the visible 'Change' word (WCAG 2.5.3).
    expect(screen.getByRole('button', { name: /change class/i, hidden: true })).toBeTruthy()
  })

  test('mech sheet has NO global Edit toggle — editing is per-section (phase 2)', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.queryByRole('button', { name: /edit this mech/i, hidden: true })).toBeNull()
    // The mech Identity FIELD section owns its own Edit button instead.
    const sectionEdit = screen.getByRole('button', { name: /edit identity/i, hidden: true })
    expect(sectionEdit.getAttribute('aria-pressed')).toBe('false')
  })

  test('crawler sheet has NO global Edit toggle — editing is per-section (phase 3)', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-1"
        entityStore={makeEntityStore([fakeCrawler])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.queryByRole('button', { name: /edit this crawler/i, hidden: true })).toBeNull()
    // The crawler Identity FIELD section owns its own Edit button instead.
    const sectionEdit = screen.getByRole('button', { name: /edit identity/i, hidden: true })
    expect(sectionEdit.getAttribute('aria-pressed')).toBe('false')
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
    expect(screen.queryByRole('button', { name: /edit this pilot/i, hidden: true })).toBeNull()
    expect(screen.queryByRole('button', { name: /edit identity/i, hidden: true })).toBeNull()
    expect(screen.queryByRole('button', { name: /share/i, hidden: true })).toBeNull()
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
    expect(screen.queryByRole('navigation', { name: /wired sheets/i, hidden: true })).toBeNull()
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
    const nav = screen.getByRole('navigation', { name: /wired sheets/i, hidden: true })
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
    const nav = screen.getByRole('navigation', { name: /wired sheets/i, hidden: true })
    const active = nav.querySelector('[aria-current="page"]')
    expect(active?.textContent).toBe('Mech')
    const links = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(links).toEqual(['/sheet/pilot/pilot-1'])
  })
})
