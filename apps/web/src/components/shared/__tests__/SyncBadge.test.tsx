import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { SyncState } from '../../../replica/syncContext'
import { SyncContext } from '../../../replica/syncContext'
import { SyncBadge } from '../SyncBadge'

/**
 * The sync badge says the connection only while a session cannot write, and
 * never to somebody who never signed in: they have nothing to be disconnected
 * from.
 */

function badgeIn(state: Partial<SyncState> & Pick<SyncState, 'status'>) {
  render(
    <SyncContext.Provider value={{ canWrite: false, outdated: false, ...state }}>
      <SyncBadge />
    </SyncContext.Provider>
  )
  return screen.queryByRole('status')
}

describe('SyncBadge', () => {
  test('says nothing signed out, settling, or live', () => {
    expect(badgeIn({ status: 'signedOut' })).toBeNull()
    expect(badgeIn({ status: 'syncing' })).toBeNull()
    expect(badgeIn({ status: 'live', canWrite: true })).toBeNull()
  })

  test('offline, it says it short and carries the full wording as its name', () => {
    const badge = badgeIn({ status: 'offline' })
    expect(badge?.textContent).toBe('Offline')
    expect(badge?.getAttribute('aria-label')).toContain('read-only until the connection returns')
  })

  test('as a dot, it carries the same name and no words', () => {
    render(
      <SyncContext.Provider value={{ status: 'offline', canWrite: false, outdated: false }}>
        <SyncBadge dot />
      </SyncContext.Provider>
    )
    const dot = screen.getByRole('status')
    expect(dot.textContent).toBe('')
    expect(dot.getAttribute('aria-label')).toContain('read-only until the connection returns')
  })

  test('outdated, it says the tab is updating', () => {
    expect(badgeIn({ status: 'live', outdated: true })?.textContent).toBe('Read-only — updating')
  })
})
