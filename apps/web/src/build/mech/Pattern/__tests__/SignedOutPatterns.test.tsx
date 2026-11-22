/**
 * The Patterns page signed out (r3 E3): it says a pattern needs a sign-in,
 * the sign-in comes back to the page, and the book's own patterns are a link.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { installServerMocks } from '../../../../components/__tests__/serverMock'
import type { SyncState } from '../../../../replica/syncContext'

const serverMocks = await installServerMocks({})
afterAll(() => serverMocks.restore())

const { SyncContext } = await import('../../../../replica/syncContext')
const { SignedOutPatterns } = await import('../SignedOutPatterns')

const SIGNED_OUT: SyncState = { status: 'signedOut', canWrite: false, outdated: false }

describe('SignedOutPatterns', () => {
  test('says patterns need a sign-in, signs in back to this page, and links the book’s patterns', () => {
    const before = window.location.href
    window.location.href = 'http://localhost/build/patterns'
    serverMocks.signIns.length = 0
    try {
      render(
        <SyncContext.Provider value={SIGNED_OUT}>
          <SignedOutPatterns />
        </SyncContext.Provider>
      )
      expect(screen.getByText(/Sign in to keep patterns/)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Sign in with Discord' }))
      expect(serverMocks.signIns).toEqual([['/patterns']])
      // Out of the app, onto the Reference: a plain link, never the app's router.
      const book = screen.getByRole('link', { name: 'See the book’s patterns' })
      expect(book.getAttribute('href')).toBe('/chassis/')
    } finally {
      window.location.href = before
    }
  })
})
