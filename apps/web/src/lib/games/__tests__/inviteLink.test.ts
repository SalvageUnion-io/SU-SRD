import { describe, expect, test } from 'bun:test'
import { invitePath, inviteTokenFrom } from '../inviteLink'

/** What the Play hub's Join accepts: an invite link, or its token alone. */

describe('inviteTokenFrom', () => {
  test('a whole link, from any origin, with or without a trailing slash or query', () => {
    expect(inviteTokenFrom('https://salvageunion.io/build/invite/AB12CD34EF56')).toBe(
      'AB12CD34EF56'
    )
    expect(inviteTokenFrom('  http://localhost:4321/build/invite/AB12CD34EF56/  ')).toBe(
      'AB12CD34EF56'
    )
    expect(inviteTokenFrom('https://x.test/build/invite/AB12CD34EF56?join=1')).toBe('AB12CD34EF56')
  })

  test('the token alone', () => {
    expect(inviteTokenFrom('AB12CD34EF56')).toBe('AB12CD34EF56')
  })

  test('anything else is not an invite', () => {
    expect(inviteTokenFrom('')).toBeNull()
    expect(inviteTokenFrom('hello there')).toBeNull()
    expect(inviteTokenFrom('https://salvageunion.io/build/play/')).toBeNull()
    expect(inviteTokenFrom('https://x.test/invite/%E0%A4%A')).toBeNull()
  })

  test('opens the invite screen', () => {
    expect(invitePath('AB12CD34EF56')).toBe('/invite/AB12CD34EF56')
  })
})
