/**
 * `PublicSheet` — a published sheet shows its assignments without naming or
 * reading what is not published (ADR-032).
 *
 * The server sends a linked entity's name and body only when it is published
 * itself, and nothing but its kind otherwise (`publicSheet.get`). This pins the other half — what the page
 * does with each: a published one is a full rail row with a View into its own
 * `/p/` page; a private one fills its slot as "Not shared", and nothing more.
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { crawlerFixture, mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import { PublicSheet } from '../PublicSheet'

beforeAll(hydrateStores)

const PILOT = pilotFixture({ id: 'p1', name: 'Kestrel Vance' })

const TO_CRAWLER = {
  type: 'pilot-to-crawler' as const,
  from: { type: 'pilot' as const, id: 'p1' },
  to: { type: 'crawler' as const, id: 'c1' },
}

type Answer = Parameters<typeof PublicSheet>[0]['answer']

function answer(over: Partial<Answer> = {}): Answer {
  return { kind: 'pilot', body: PILOT, links: [], linked: [], withheld: [], ...over }
}

describe('a public sheet’s assignments', () => {
  test('a private mech and crawler fill their slots as "Not shared", unnamed', () => {
    render(
      <PublicSheet
        appId="p1"
        answer={answer({ withheld: [{ kind: 'mech' }, { kind: 'crawler' }] })}
      />
    )

    expect(screen.getAllByText('Not shared')).toHaveLength(2)
    // Nothing to open: neither has a page a reader may see.
    expect(screen.queryByRole('link', { name: /^View / })).toBeNull()
    // And never reported as missing: the pilot HAS a mech and a crawler.
    expect(screen.queryByText(/No mech assigned/i)).toBeNull()
    expect(screen.queryByText(/No crawler assigned/i)).toBeNull()
  })

  test('a published one is a full, named row that opens its own public page', () => {
    render(
      <PublicSheet
        appId="p1"
        answer={answer({
          links: [TO_CRAWLER],
          linked: [
            {
              kind: 'crawler',
              id: 'c1',
              name: '#430 Tenacity',
              body: crawlerFixture({ id: 'c1', name: '#430 Tenacity' }),
            },
          ],
          withheld: [{ kind: 'mech' }],
        })}
      />
    )

    expect(screen.getByRole('link', { name: /#430 Tenacity$/ }).getAttribute('href')).toBe(
      '/p/crawler/c1'
    )
    // The private mech beside it is still only a filled slot.
    expect(screen.getAllByText('Not shared')).toHaveLength(1)
  })

  test('a published body that does not parse is named, not rendered', () => {
    render(
      <PublicSheet
        appId="p1"
        answer={answer({
          linked: [
            {
              kind: 'mech',
              id: 'm1',
              name: 'Iron Mongrel',
              body: { ...mechFixture({ id: 'm1' }), systems: 'nope' },
            },
          ],
        })}
      />
    )
    expect(screen.getByText('Iron Mongrel')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'View Iron Mongrel' })).toBeNull()
  })

  test('a shared mech offers the way to a build of your own; a pilot does not (r4 E18)', () => {
    const mech = mechFixture({ id: 'm1', name: 'Iron Mongrel' })
    const shown = render(<PublicSheet appId="m1" answer={answer({ kind: 'mech', body: mech })} />)
    // No provider is the signed-out visitor: signing in is how you build from it.
    expect(screen.getByRole('button', { name: 'Sign in to build from this' })).toBeTruthy()
    shown.unmount()
    render(<PublicSheet appId="p1" answer={answer()} />)
    expect(screen.queryByRole('button', { name: 'Sign in to build from this' })).toBeNull()
  })

  test('is read-only', () => {
    render(<PublicSheet appId="p1" answer={answer()} />)
    expect(screen.getByRole('note', { name: 'Read-only sheet' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Share this pilot$/ })).toBeNull()
  })
})

describe('a shared mech on a phone (r5 C18)', () => {
  const realMatchMedia = window.matchMedia
  afterEach(() => {
    window.matchMedia = realMatchMedia
  })
  // Every width query answers no (a phone), and so does `print`.
  const widths = (wide: boolean) => {
    window.matchMedia = ((query: string) => ({
      matches: wide && query.includes('width'),
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia
  }
  const mech = mechFixture({
    id: 'm1',
    name: 'Iron Mongrel',
    chassisRef: 'mule',
    systems: ['floodlights'],
    modules: ['zoom-optics'],
  })
  const before = (a: Element, b: Element) =>
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

  test('leads with Systems and Modules, its vitals one compact row under them', () => {
    widths(false)
    const { container } = render(
      <PublicSheet appId="m1" answer={answer({ kind: 'mech', body: mech })} />
    )
    const systems = screen.getByRole('table', { name: /^Systems/ })
    const mast = container.querySelector('.su-mast')
    expect(mast).toBeTruthy()
    expect(before(systems, mast as Element)).toBe(true)
    expect(mast?.hasAttribute('data-compact')).toBe(true)
  })

  test('wider than a phone the masthead still leads', () => {
    widths(true)
    const { container } = render(
      <PublicSheet appId="m1" answer={answer({ kind: 'mech', body: mech })} />
    )
    const systems = screen.getByRole('table', { name: /^Systems/ })
    const mast = container.querySelector('.su-mast') as Element
    expect(before(mast, systems)).toBe(true)
    expect(mast.hasAttribute('data-compact')).toBe(false)
  })
})
