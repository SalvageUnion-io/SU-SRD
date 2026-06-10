/**
 * Plan 4.8 integration surface — top-bar Edit action + mobile segment switch.
 *
 *   - Edit renders as a trailing link to the entity's edit wizard route,
 *     hidden when readOnly (snapshots).
 *   - The segmented Pilot/Mech/Crawler switch (design §3.7) renders only on
 *     wired compositions: one segment per present counterpart, the viewed
 *     kind marked active (aria-current, rust fill), the others linking to
 *     their wired counterpart's sheet.
 *
 * Rendered without a RouterProvider — AppLink degrades to plain anchors, so
 * hrefs are asserted directly.
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
  return {
    get: (_type, id) => {
      // EntityLookup's conditional return type can't be satisfied without a cast
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (entities.find((e) => e.id === id) ?? null) as any
    },
  }
}

function makeSoftLinkStore(links: SoftLink[]): SoftLinkStore {
  // The create mock is unused here; cast is safe — these tests never assign()
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
  test('pilot sheet links Edit to /pilots/$id/edit', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    const edit = screen.getByRole('link', { name: /edit this pilot/i })
    expect((edit as HTMLAnchorElement).getAttribute('href')).toBe('/pilots/pilot-1/edit')
  })

  test('mech and crawler sheets link their own edit routes', () => {
    const { unmount } = render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByRole('link', { name: /edit this mech/i }).getAttribute('href')).toBe(
      '/mechs/mech-1/edit'
    )
    unmount()

    render(
      <Sheet
        kind="crawler"
        id="crawler-1"
        entityStore={makeEntityStore([fakeCrawler])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByRole('link', { name: /edit this crawler/i }).getAttribute('href')).toBe(
      '/crawlers/crawler-1/edit'
    )
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
    expect(screen.queryByRole('link', { name: /edit this pilot/i })).toBeNull()
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
