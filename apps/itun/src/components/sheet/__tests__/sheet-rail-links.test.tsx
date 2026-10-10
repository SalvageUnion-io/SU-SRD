/**
 * Replacement coverage for the deleted route tests (cross-links.test.tsx +
 * detail-routes.test.tsx), reframed onto the single view+edit Sheet surface:
 *
 *   1. Cross-links on the rail — a wired sheet renders rail chips that link to
 *      its wired counterparts (`/sheet/<kind>/<id>`). Anchors are asserted
 *      directly (no RouterProvider → AppLink degrades to plain `<a href>`).
 *   2. Entity-not-found — an id absent from the store renders the styled
 *      "{kind} not found" surface with a "Back to Roster" exit link.
 *   3. Rail unassign availability — per the unified edit language the linked
 *      row's Unassign control is always available on editable sheets and
 *      never rendered on read-only (snapshot) sheets. It is "Unassign", not
 *      the trash Delete: it removes the link and leaves the entity alone.
 *   4. Every slot can be assigned and changed from its own sheet (ADR-037):
 *      the pilot's mech and crawler, the mech's pilot and its OWN crawler, the
 *      crawler's crew and bay.
 *
 * Fixture/store setup mirrors Sheet-topbar-segments.test.tsx.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { SoftLink } from '../../../lib/schemas/softLink'
import { useEntityStore } from '../../../stores/entityStore'
import {
  crawlerFixture,
  mechFixture,
  pilotFixture,
  softLinkFixture,
} from '../../__tests__/fixtures'
import { hydrateStores } from '../../__tests__/hydrateStores'
import {
  makeEntityLookupMock,
  makeEntityStoreMock,
  makeSoftLinkStoreMock,
} from '../../__tests__/mockEntityStore'
import { Sheet } from '../Sheet'

// Each, not All: the afterEach below un-hydrates the live store.
beforeEach(hydrateStores)

afterEach(() => {
  cleanup()
  // Reset the live store so the Unassign test (which seeds softLinks into the
  // real store to derive the link id) never leaks into other tests.
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, npcs: false, softLinks: false },
  })
})

const fakePilot = pilotFixture({
  id: 'pilot-1',
  name: 'Yara Voss',
  callsign: 'Ghost',
  motto: 'Waste not.',
  keepsake: 'A bent coin.',
  appearance: 'Tall, weathered.',
})

const fakeMech = mechFixture({
  id: 'mech-1',
  name: 'Iron Fist',
  chassisRef: 'iron-mongrel',
})

const fakeCrawler = crawlerFixture({
  id: 'crawler-1',
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
})

const mechToPilot = softLinkFixture('mech-to-pilot', 'mech-1', 'pilot-1')
const pilotToCrawler = softLinkFixture('pilot-to-crawler', 'pilot-1', 'crawler-1')
const mechToCrawler = softLinkFixture('mech-to-crawler', 'mech-1', 'crawler-1')

// ---------------------------------------------------------------------------
// 1. Cross-links on the rail
// ---------------------------------------------------------------------------

/**
 * The linked-unit slots render the roster's `EntityRow`, whose View link is
 * labelled "View" on every row — so a link is targeted by its DESTINATION here
 * rather than by an accessible name that no longer distinguishes rows. That is
 * what these tests were ever asserting: that the cross-link points at the right
 * sheet.
 */
function linkTo(href: string): HTMLElement {
  const match = screen.getAllByRole('link').find((a) => a.getAttribute('href') === href)
  if (!match) throw new Error(`no link to ${href}`)
  return match
}

describe('Sheet — rail cross-links', () => {
  test('wired pilot sheet links to its assigned mech and home crawler', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([mechToPilot, pilotToCrawler])}
      />
    )
    expect(linkTo('/sheet/mech/mech-1')).toBeTruthy()
    expect(linkTo('/sheet/crawler/crawler-1')).toBeTruthy()
  })

  test('wired mech sheet links to its assigned pilot', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeMech])}
        softLinkStore={makeSoftLinkStoreMock([mechToPilot])}
      />
    )
    expect(linkTo('/sheet/pilot/pilot-1')).toBeTruthy()
  })

  test('wired mech sheet links to the crawler it is docked in by its own link', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([mechToCrawler])}
      />
    )
    expect(linkTo('/sheet/crawler/crawler-1')).toBeTruthy()
  })

  test('wired crawler sheet links to its pilots and docked mechs', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([mechToPilot, pilotToCrawler, mechToCrawler])}
      />
    )
    // Crew = every pilot wired to the crawler; the bay = every mech docked by
    // its own mech-to-crawler link (ADR-037), not reached through a pilot.
    expect(linkTo('/sheet/pilot/pilot-1')).toBeTruthy()
    expect(linkTo('/sheet/mech/mech-1')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// 2. Entity-not-found path
// ---------------------------------------------------------------------------

describe('Sheet — entity not found', () => {
  test('unknown id renders the not-found heading + back-to-Roster link', () => {
    render(
      <Sheet
        kind="pilot"
        id="does-not-exist"
        entityStore={makeEntityLookupMock([])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    expect(screen.getByRole('heading', { name: /pilot not found/i })).toBeTruthy()

    const back = screen.getByRole('link', { name: /back to roster/i })
    expect(back.getAttribute('href')).toBe('/')
  })

  test('not-found path uses the viewed kind in the heading', () => {
    render(
      <Sheet
        kind="mech"
        id="does-not-exist"
        entityStore={makeEntityLookupMock([])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    expect(screen.getByRole('heading', { name: /mech not found/i })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// 3. Unassigning (EntityRow's Unassign — never its Delete)
// ---------------------------------------------------------------------------

/**
 * A sheet over one mock store: composition, the rail's link ids and the
 * unassign write all read the same snapshot, so a test can assert the write.
 */
function renderOver(
  kind: 'pilot' | 'mech' | 'crawler',
  id: string,
  links: SoftLink[],
  readOnly = false
) {
  const deleteFn = mock(async (_type: string, _id: string) => {})
  const store = makeEntityStoreMock({
    pilots: [fakePilot],
    mechs: [fakeMech],
    crawlers: [fakeCrawler],
    softLinks: links,
    delete: deleteFn,
  })
  render(<Sheet kind={kind} id={id} store={store} readOnly={readOnly} />)
  return { deleteFn }
}

describe('Sheet — rail unassign availability (unified edit language)', () => {
  test('Unassign removes the LINK, and is not dressed as a delete', async () => {
    const { deleteFn } = renderOver('pilot', 'pilot-1', [mechToPilot])

    // The trash glyph means "destroy this mech" everywhere else it appears.
    expect(screen.queryByRole('button', { name: /^Delete Iron Fist$/i })).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Unassign Iron Fist$/i }))
    })

    expect(deleteFn).toHaveBeenCalledTimes(1)
    expect(deleteFn).toHaveBeenCalledWith('softLink', mechToPilot.id)
  })

  test('every filled slot can be unassigned: crew, bay, a mech’s pilot and crawler', () => {
    renderOver('crawler', 'crawler-1', [pilotToCrawler, mechToCrawler])
    expect(screen.getByRole('button', { name: /^Unassign Yara Voss$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Unassign Iron Fist$/i })).toBeTruthy()
    cleanup()

    renderOver('mech', 'mech-1', [mechToPilot, mechToCrawler])
    expect(screen.getByRole('button', { name: /^Unassign Yara Voss$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Unassign Iron Tortoise$/i })).toBeTruthy()
  })

  test('unassign is always available on an editable sheet, never on read-only', () => {
    // The rail's Unassign link id is derived from the LIVE store's softLinks
    // (composition only exposes resolved entities), so seed the real store —
    // composition + PublishButton still read the injected snapshots. Every
    // type is marked hydrated so no read starts a load that lands after act().
    useEntityStore.setState({
      softLinks: [mechToPilot],
      hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
    })

    const { unmount } = render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeMech])}
        softLinkStore={makeSoftLinkStoreMock([mechToPilot])}
      />
    )

    // Sanity: the wired mech row is present.
    expect(linkTo('/sheet/mech/mech-1')).toBeTruthy()

    // Collection add/remove is ALWAYS available on editable sheets — no edit
    // mode gate (redesign archetype B).
    expect(screen.getByRole('button', { name: /^Unassign Iron Fist$/i })).toBeTruthy()
    unmount()

    // Read-only (snapshot) sheets never expose a write.
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot, fakeMech])}
        softLinkStore={makeSoftLinkStoreMock([mechToPilot])}
        readOnly
      />
    )
    expect(screen.queryByRole('button', { name: /^Unassign Iron Fist$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Delete Iron Fist$/i })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 4. Every slot assigns and changes from its own sheet
// ---------------------------------------------------------------------------

const button = (name: RegExp) => screen.queryByRole('button', { name })

describe('Sheet — every slot can be assigned from its own sheet (ADR-037)', () => {
  test('a pilot sheet assigns a mech and a crawler when empty, changes them when filled', () => {
    renderOver('pilot', 'pilot-1', [])
    expect(button(/^Assign mech to pilot$/i)).toBeTruthy()
    expect(button(/^Assign crawler to pilot$/i)).toBeTruthy()
    cleanup()

    renderOver('pilot', 'pilot-1', [mechToPilot, pilotToCrawler])
    expect(button(/^Change mech for this pilot$/i)).toBeTruthy()
    expect(button(/^Change crawler for this pilot$/i)).toBeTruthy()
    expect(button(/^Assign mech to pilot$/i)).toBeNull()
  })

  test('a mech’s crawler is its own: a pilot crewing one does not dock the mech', () => {
    // The mech flies Yara, and Yara crews the Iron Tortoise — but the mech has
    // no `mech-to-crawler` link, so its own crawler slot is empty and offers
    // the assignment rather than showing the pilot's crawler.
    renderOver('mech', 'mech-1', [mechToPilot, pilotToCrawler])
    expect(
      screen
        .queryAllByRole('link')
        .some((a) => a.getAttribute('href') === '/sheet/crawler/crawler-1')
    ).toBe(false)
    expect(button(/^Assign crawler to mech$/i)).toBeTruthy()
    expect(button(/^Change pilot for this mech$/i)).toBeTruthy()
    cleanup()

    renderOver('mech', 'mech-1', [mechToCrawler])
    expect(linkTo('/sheet/crawler/crawler-1')).toBeTruthy()
    expect(button(/^Change crawler for this mech$/i)).toBeTruthy()
    expect(button(/^Assign pilot to mech$/i)).toBeTruthy()
  })

  test('a crawler sheet adds crew and docks mechs, empty or not', () => {
    renderOver('crawler', 'crawler-1', [])
    expect(button(/^\+ Add Crew$/)).toBeTruthy()
    expect(button(/^\+ Dock Mech$/)).toBeTruthy()
    cleanup()

    renderOver('crawler', 'crawler-1', [pilotToCrawler, mechToCrawler])
    expect(button(/^\+ Add Crew$/)).toBeTruthy()
    expect(button(/^\+ Dock Mech$/)).toBeTruthy()
  })

  test('a read-only sheet offers no picker at all', () => {
    renderOver('pilot', 'pilot-1', [], true)
    expect(button(/assign/i)).toBeNull()
    cleanup()
    renderOver('crawler', 'crawler-1', [pilotToCrawler], true)
    expect(button(/add crew|dock mech|unassign/i)).toBeNull()
  })
})
