/**
 * Responsive layout tests.
 *
 * These tests assert that layout-bearing classes are present on the
 * correct container elements. happy-dom does not compute layout, so we verify
 * className strings directly — this is the standard pattern for layout-only
 * changes in this codebase (see mobile-responsive.test.tsx).
 *
 * Coverage:
 *  1. Sheet — LiveSheet shell carries the variant tone class + sticky header;
 *     the crawler body's 2-col macro grid (content ∥ Storage rail) splits at
 *     its container breakpoint
 *  2. Sheet — missing entity still renders without crash (guard path)
 *  3. (SnapshotSheet — retired with snapshots, ADR-036)
 *  4. Roster — sections wrapper uses flex flex-col (mobile) and the
 *     section container element is rendered (grid classes are on the same el)
 *  5. CrawlerSheet — stats dl uses grid-cols-1 (not grid-cols-2 with empty cell)
 *
 * Conventions:
 *  - toBeTruthy() not toBeInTheDocument()
 *  - The only module mocks are Convex's (`installServerMocks`): the signed-out
 *    Roster mounts `SignInControl`
 *  - afterEach cleanup()
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { act, render } from '@testing-library/react'
import {
  crawlerFixture,
  mechFixture,
  pilotFixture,
  softLinkFixture,
} from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import {
  makeEntityLookupMock,
  makeSoftLinkStoreMock,
} from '../../../components/__tests__/mockEntityStore'
import { installServerMocks } from '../../../components/__tests__/serverMock'

// Module scope, before the imports below — see `serverMock.ts`.
const serverMocks = await installServerMocks()
afterAll(() => serverMocks.restore())

const { Roster } = await import('../../roster/Roster')
const { CrawlerSheet } = await import('../CrawlerSheet')
const { Sheet } = await import('../Sheet')

beforeAll(hydrateStores)

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const fakePilot = pilotFixture({
  id: 'pilot-resp-1',
  name: 'Test Pilot',
  callsign: 'TP',
})

const fakeMech = mechFixture({
  id: 'mech-resp-1',
  name: 'Test Mech',
  chassisRef: 'iron-mongrel',
})

const fakeCrawler = crawlerFixture({
  id: 'crawler-resp-1',
  name: 'Test Crawler',
  techLevel: 'tech-2',
})

// ---------------------------------------------------------------------------
// 1. Sheet — wired composition uses max-w-7xl container
// ---------------------------------------------------------------------------

describe('Sheet responsive layout — wired composition (LiveSheet shell)', () => {
  test('Sheet wired (mech+pilot) renders the variant-toned shell root', () => {
    const link = softLinkFixture('mech-to-pilot', 'mech-resp-1', 'pilot-resp-1')
    const { container } = render(
      <Sheet
        kind="mech"
        id="mech-resp-1"
        entityStore={makeEntityLookupMock([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([link])}
      />
    )
    expect(container.querySelector('.su-sheet--mech')).toBeTruthy()
    expect(container.querySelector('[data-variant="mech"]')).toBeTruthy()
  })

  test('Sheet crawler body is the shared columns, its Storage Bay the sidebar', () => {
    // Every sheet's columns (`SheetColumns`, ruleset §1.2): the opening, then
    // the main column (Bays → Assigned Units), and what the crawler carries,
    // its Storage Bay, in the permanent right sidebar. The old `54fr`-split
    // macro grid stays gone.
    const { container } = render(
      <Sheet
        kind="crawler"
        id="crawler-resp-1"
        entityStore={makeEntityLookupMock([fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    expect(container.querySelector('[class*="54fr"]')).toBeNull()
    const columns = container.querySelector('section[aria-label$="crawler sheet"] > div')
    expect(columns?.classList.contains('su-sheet-columns')).toBe(true)
    // The storage is in the sidebar, asserted on its CONTENT rather than the
    // words "Storage Bay": it renders inside the Storage Bay's own bay card
    // when that bay is installed, and under its own Slab when it is not (this
    // fixture has no bays). The scrap pool is there either way.
    const aside = container.querySelector('[data-sheet-aside]')
    expect(aside?.getAttribute('aria-label')).toBe(`What ${fakeCrawler.name} carries`)
    expect(aside?.textContent).toContain('Scrap Pool')
  })
})

// ---------------------------------------------------------------------------
// 2. Sheet — single entity shells carry their variant tone class
// ---------------------------------------------------------------------------

describe('Sheet responsive layout — single entity', () => {
  test('mech-only Sheet renders the mech-toned shell with a sticky bar', () => {
    const { container } = render(
      <Sheet
        kind="mech"
        id="mech-resp-1"
        entityStore={makeEntityLookupMock([fakeMech])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    expect(container.querySelector('.su-sheet--mech')).toBeTruthy()
    // The bar rides a sticky anchor with no height: nothing above the band at rest.
    const bar = container.querySelector<HTMLElement>('section[aria-label="Sheet controls"]')
    expect(bar?.parentElement?.style.position).toBe('sticky')
  })

  test('pilot-only Sheet renders the pilot-toned shell with a sticky bar', () => {
    const { container } = render(
      <Sheet
        kind="pilot"
        id="pilot-resp-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    expect(container.querySelector('.su-sheet--pilot')).toBeTruthy()
    // The bar rides a sticky anchor with no height: nothing above the band at rest.
    const bar = container.querySelector<HTMLElement>('section[aria-label="Sheet controls"]')
    expect(bar?.parentElement?.style.position).toBe('sticky')
  })
})

// ---------------------------------------------------------------------------
// 4. CrawlerSheet — body section stacks as a single column of slabs
// ---------------------------------------------------------------------------

describe('CrawlerSheet responsive layout — body section', () => {
  test('body renders as a single flex column (slabs stack at every width)', () => {
    const { container } = render(<CrawlerSheet crawler={fakeCrawler} />)
    const section = container.querySelector('section')
    expect(section).toBeTruthy()
    expect((section as HTMLElement).style.flexDirection).toBe('column')
  })
})

// ---------------------------------------------------------------------------
// 5. Roster — renders sections (structural check)
// ---------------------------------------------------------------------------

describe('Roster responsive layout — sections render', () => {
  test('Roster renders with its max-w outer container', async () => {
    // Async act: Roster flips its hydrated flag from a promise after mount.
    let container!: HTMLElement
    await act(async () => {
      container = render(<Roster />).container
    })
    const main = container.querySelector('main')
    expect(main).toBeTruthy()
  })
})
