/**
 * unitOwners — who holds each pilot and mech a Game lists, as the roster's
 * owner seal reads it: YOU, a crewmate's name, UNASSIGNED.
 */

import { describe, expect, test } from 'bun:test'
import { ownersFromListing } from '../unitOwners.model'

const row = (appId: string | null, ownerId: string | null, body: unknown = {}) => ({
  _id: `row-${appId ?? 'x'}`,
  appId,
  ownerId,
  body,
})

describe('ownersFromListing', () => {
  const ownerOf = ownersFromListing(
    {
      pilots: [row('p1', 'u1'), row('p2', 'u2'), row(null, null, { id: 'p3' })],
      mechs: [row('m1', 'u9')],
    },
    [
      { userId: 'u1', displayName: 'Jrvs' },
      { userId: 'u2', displayName: 'Mara' },
    ],
    'u1'
  )

  test('the viewer reads You, a crewmate their name, nobody Unassigned', () => {
    expect(ownerOf('pilot', 'p1')?.label).toBe('You')
    expect(ownerOf('pilot', 'p2')?.label).toBe('Mara')
    expect(ownerOf('pilot', 'p3')?.label).toBe('Unassigned')
  })

  test('an owner the roster cannot name is a crewmate, never unassigned', () => {
    expect(ownerOf('mech', 'm1')).toEqual({ label: 'Crewmate', unassigned: false, mine: false })
  })

  test('a unit the Game does not list has no chip, and kinds never mix', () => {
    expect(ownerOf('pilot', 'nope')).toBeUndefined()
    expect(ownerOf('mech', 'p1')).toBeUndefined()
  })
})
