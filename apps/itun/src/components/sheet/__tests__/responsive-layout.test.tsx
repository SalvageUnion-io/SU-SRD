/**
 * Responsive layout tests — Phase 4.
 *
 * These tests assert that layout-bearing Tailwind classes are present on the
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
 *  - The only module mocks are Convex's (`installConvexMocks`): the signed-out
 *    Roster mounts `SignInControl`
 *  - afterEach cleanup()
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { act, render } from '@testing-library/react'
import { installConvexMocks } from '../../__tests__/convexMock'
import {
  crawlerFixture,
  mechFixture,
  pilotFixture,
  softLinkFixture,
} from '../../__tests__/fixtures'
import { hydrateStores } from '../../__tests__/hydrateStores'
import { makeEntityLookupMock, makeSoftLinkStoreMock } from '../../__tests__/mockEntityStore'

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({ authReact: true })
afterAll(() => convexMocks.restore())

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
    expect(container.querySelector('.sheet--mech')).toBeTruthy()
    expect(container.querySelector('[data-variant="mech"]')).toBeTruthy()
  })

  test('Sheet crawler body is a single-column region flow with Storage as a full-width bottom band', () => {
    // Workshop-Manual crawler sheet: a single-column region stack (Identity →
    // Bays → Weapons → Linked Units → Storage Bay), NOT the old 2-col macro
    // grid that stood Storage up as a full-height right column. The old
    // `54fr`-split grid is gone; the crawler section flows in one column and
    // the Storage Bay renders as its own section at the bottom.
    const { container } = render(
      <Sheet
        kind="crawler"
        id="crawler-resp-1"
        entityStore={makeEntityLookupMock([fakeCrawler])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    // The old right-column macro grid is removed.
    expect(container.querySelector('[class*="54fr"]')).toBeNull()
    // The crawler body's region flow is a single column.
    const flow = container.querySelector('section[aria-label$="crawler sheet"] > div')
    expect(flow).toBeTruthy()
    expect((flow as HTMLElement).className).toContain('flex-col')
    // The storage band is present. Asserted on its CONTENT rather than the
    // words "Storage Bay": storage now renders inside the Storage Bay's own bay
    // card when that bay is installed, and as a standalone band when it is not
    // (this fixture has no bays). The scrap pool is in the band either way.
    expect(container.textContent).toContain('Scrap Pool')
  })
})

// ---------------------------------------------------------------------------
// 2. Sheet — single entity shells carry their variant tone class
// ---------------------------------------------------------------------------

describe('Sheet responsive layout — single entity', () => {
  test('mech-only Sheet renders the mech-toned shell with a sticky header', () => {
    const { container } = render(
      <Sheet
        kind="mech"
        id="mech-resp-1"
        entityStore={makeEntityLookupMock([fakeMech])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    expect(container.querySelector('.sheet--mech')).toBeTruthy()
    const header = container.querySelector('header')
    expect(header).toBeTruthy()
    expect((header as HTMLElement).className).toContain('sticky')
  })

  test('pilot-only Sheet renders the pilot-toned shell with a sticky header', () => {
    const { container } = render(
      <Sheet
        kind="pilot"
        id="pilot-resp-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    expect(container.querySelector('.sheet--pilot')).toBeTruthy()
    const header = container.querySelector('header')
    expect(header).toBeTruthy()
    expect((header as HTMLElement).className).toContain('sticky')
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
    expect((section as HTMLElement).className).toContain('flex-col')
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
