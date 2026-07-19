/**
 * Tests for PublishButton — since the Share Snapshot screen (plan 5.2) this
 * is the sheet top-bar 'Share' entry point: a link to /sheet/:kind/:id/share.
 * Publishing itself is exercised in ShareSnapshotScreen.test.tsx.
 *
 * Conventions:
 *   - toBeTruthy() / toBeFalsy() — not toBeInTheDocument()
 *   - No mock.module(); AppLink degrades to <a href> without a router
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'

import { PublishButton } from '../PublishButton'

afterEach(() => {
  cleanup()
})

describe('PublishButton — share-screen entry link', () => {
  test('renders a Share link', () => {
    render(<PublishButton entityKind="pilot" entityId="pilot-1" />)
    expect(screen.getByRole('link', { name: /share this pilot/i })).toBeTruthy()
  })

  test('links to the share-snapshot route for the entity', () => {
    render(<PublishButton entityKind="mech" entityId="mech-42" />)
    const link = screen.getByRole('link', { name: /share this mech/i })
    expect(link.getAttribute('href')).toBe('/sheet/mech/mech-42/share')
  })

  test('keeps the mobile touch-target class on the link', () => {
    render(<PublishButton entityKind="crawler" entityId="crawler-7" />)
    const link = screen.getByRole('link', { name: /share this crawler/i })
    expect(link.className).toContain('min-h-11')
  })
})
