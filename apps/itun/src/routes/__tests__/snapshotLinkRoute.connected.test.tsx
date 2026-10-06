import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'

/**
 * `/s/$id` against Convex: redirect if public, retired page otherwise
 * (ADR-036).
 *
 * "Is it public" is `publicSheet.get` — the public page's own unauthenticated
 * query — answered here by name (`convexMock.ts`). The router is stubbed so the
 * redirect is a recorded `navigate` call rather than a real navigation.
 */

import {
  installConvexMocks,
  queryCalls,
  setQueryAnswers,
} from '../../components/__tests__/convexMock'

// Module scope, before the import below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts` for the capture/restore rules.
const convexMocks = await installConvexMocks({ router: true })
const { navigations } = convexMocks

const { SnapshotLinkView } = await import('../../components/sheet/SnapshotLinkView')

const IDENTITY = { kind: 'mech', appId: 'm-app-1' } as const

beforeEach(() => {
  navigations.length = 0
})

describe('a retired snapshot link, with Convex', () => {
  test('redirects — replacing the URL — to the live sheet when the entity is public', () => {
    setQueryAnswers({ 'publicSheet:get': { kind: 'mech', body: {}, pilotAbilities: [] } })

    render(<SnapshotLinkView identity={IDENTITY} />)

    expect(navigations).toEqual([
      { to: '/p/$kind/$appId', params: { kind: 'mech', appId: 'm-app-1' }, replace: true },
    ])
    // The query is asked exactly `{ kind, appId }`: Convex rejects extra fields.
    expect(queryCalls()).toEqual([
      { name: 'publicSheet:get', args: { kind: 'mech', appId: 'm-app-1' } },
    ])
  })

  test('shows the retired page, and does not redirect, when it is not public', () => {
    // `null` is both "private" and "no such entity", on purpose — the page must
    // not confirm which.
    setQueryAnswers({ 'publicSheet:get': null })

    render(<SnapshotLinkView identity={IDENTITY} />)

    expect(screen.getByRole('heading', { name: /this share link has been retired/i })).toBeTruthy()
    expect(navigations).toEqual([])
  })

  test('holds a skeleton, not the retired page, while the answer is loading', () => {
    // `undefined` is Convex's "still loading". Collapsing it into `null` would
    // flash "retired" on every link that is about to redirect.
    setQueryAnswers({ 'publicSheet:get': undefined })

    render(<SnapshotLinkView identity={IDENTITY} />)

    expect(screen.getByRole('status', { name: /loading sheet/i })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /retired/i })).toBeNull()
    expect(navigations).toEqual([])
  })

  test('an unknown snapshot asks Convex nothing and shows the retired page', () => {
    setQueryAnswers({})

    render(<SnapshotLinkView identity={null} />)

    expect(screen.getByRole('heading', { name: /this share link has been retired/i })).toBeTruthy()
    expect(queryCalls()).toEqual([])
    expect(navigations).toEqual([])
  })
})

afterAll(convexMocks.restore)
