/**
 * `/s/$id` in a build with no Convex (ADR-036).
 *
 * A retired snapshot link resolves to a live public sheet only through Convex,
 * so without it every link is retired — and, as with `/p/$kind/$appId`
 * (`publicSheetRoute.test.tsx`), the page must render rather than reach a
 * `useQuery` that throws "Could not find Convex client!". The redirect itself
 * is `snapshotLinkRoute.connected.test.tsx`.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SnapshotLinkView } from '../../components/sheet/SnapshotLinkView'
import { isConvexConfigured } from '../../lib/connection/convexClient'

describe('a retired snapshot link in a Solo build', () => {
  test('the test environment really is Convex-free', () => {
    // If this ever flips, the assertions below stop testing what they claim to.
    expect(isConvexConfigured).toBe(false)
  })

  test('an unknown id shows the retired page', () => {
    render(<SnapshotLinkView identity={null} />)
    expect(screen.getByRole('heading', { name: /this share link has been retired/i })).toBeTruthy()
    // It says what to do instead, and offers a way out.
    expect(screen.getByText(/live public sheet/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /back to roster/i })).toBeTruthy()
  })

  test('a resolvable id shows the retired page too, rather than throwing', () => {
    expect(() =>
      render(<SnapshotLinkView identity={{ kind: 'pilot', appId: 'p-1' }} />)
    ).not.toThrow()
    expect(screen.getByRole('heading', { name: /this share link has been retired/i })).toBeTruthy()
  })

  test('never renders a frozen sheet', () => {
    render(<SnapshotLinkView identity={null} />)
    expect(screen.queryByRole('note', { name: /read-only snapshot/i })).toBeNull()
  })
})
