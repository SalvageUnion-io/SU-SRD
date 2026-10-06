/**
 * `PublicSheet` — a published sheet shows its assignments, by name, without
 * reading what is not published (ADR-032).
 *
 * The server sends a linked entity's body only when it is published itself
 * (`publicSheet.get`, pinned in `test/convex/liveSheet.test.ts`); this pins the
 * other half — what the page does with each: a published one is a full rail row
 * with a View into its own `/p/` page, a private one is named in its slot and
 * nothing more.
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { crawlerFixture, mechFixture, pilotFixture } from '../../__tests__/fixtures'
import { hydrateStores } from '../../__tests__/hydrateStores'
import { PublicSheet } from '../PublicSheet'

beforeAll(hydrateStores)
afterEach(cleanup)

const PILOT = pilotFixture({ id: 'p1', name: 'Kestrel Vance' })

function answer(
  linked: Array<{ kind: 'mech' | 'crawler'; id: string; name: string; body?: unknown }>
) {
  return {
    kind: 'pilot',
    body: PILOT,
    links: [
      {
        type: 'mech-to-pilot' as const,
        from: { type: 'mech' as const, id: 'm1' },
        to: { type: 'pilot' as const, id: 'p1' },
      },
      {
        type: 'pilot-to-crawler' as const,
        from: { type: 'pilot' as const, id: 'p1' },
        to: { type: 'crawler' as const, id: 'c1' },
      },
    ],
    linked,
  }
}

describe('a public sheet’s assignments', () => {
  test('a private mech and crawler are named in their slots, with no way in', () => {
    render(
      <PublicSheet
        appId="p1"
        answer={answer([
          { kind: 'mech', id: 'm1', name: 'Iron Mongrel' },
          { kind: 'crawler', id: 'c1', name: '#430 Tenacity' },
        ])}
      />
    )

    expect(screen.getByText('Iron Mongrel')).toBeTruthy()
    expect(screen.getByText('#430 Tenacity')).toBeTruthy()
    expect(screen.getAllByText('Not shared')).toHaveLength(2)
    // Named, never opened: neither has a page a reader may see.
    expect(screen.queryByRole('link', { name: 'View Iron Mongrel' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'View #430 Tenacity' })).toBeNull()
    // And never reported as missing: the pilot HAS a mech.
    expect(screen.queryByText(/No mech assigned/i)).toBeNull()
  })

  test('a published one is a full row that opens its own public page', () => {
    render(
      <PublicSheet
        appId="p1"
        answer={answer([
          { kind: 'mech', id: 'm1', name: 'Iron Mongrel' },
          {
            kind: 'crawler',
            id: 'c1',
            name: '#430 Tenacity',
            body: crawlerFixture({ id: 'c1', name: '#430 Tenacity' }),
          },
        ])}
      />
    )

    expect(screen.getByRole('link', { name: 'View #430 Tenacity' }).getAttribute('href')).toBe(
      '/p/crawler/c1'
    )
    // The private mech beside it is still only named.
    expect(screen.queryByRole('link', { name: 'View Iron Mongrel' })).toBeNull()
  })

  test('a linked body that does not parse is named, not rendered', () => {
    render(
      <PublicSheet
        appId="p1"
        answer={answer([
          {
            kind: 'mech',
            id: 'm1',
            name: 'Iron Mongrel',
            body: { ...mechFixture({ id: 'm1' }), systems: 'nope' },
          },
        ])}
      />
    )
    expect(screen.getByText('Iron Mongrel')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'View Iron Mongrel' })).toBeNull()
  })

  test('is read-only', () => {
    render(<PublicSheet appId="p1" answer={answer([])} />)
    expect(screen.getByRole('note', { name: 'Read-only sheet' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Share this pilot$/ })).toBeNull()
  })
})
