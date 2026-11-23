import { describe, expect, test } from 'bun:test'
import { pilotMechs } from '../crewMechs.model'

/** r8 C5 (LG8-09): a pregen's spare Mech, taken by another player, is listed once, under them. */
describe('pilotMechs', () => {
  const owners = new Map<string, string | null>([
    ['mazona', 'priya'],
    ['scrapper', null],
  ])
  const ownerOf = (id: string) => owners.get(id)

  test('a Mech taken and boarded by another Pilot leaves its old Pilot', () => {
    const mechs = pilotMechs(
      [
        { id: 'hotdog', ownerId: null, boarded: false, mechId: 'mazona' },
        { id: 'magpie', ownerId: 'priya', boarded: true, mechId: 'mazona' },
      ],
      ownerOf
    )
    expect(mechs.get('hotdog')).toBeNull()
    expect(mechs.get('magpie')).toBe('mazona')
  })

  test('a Mech taken by another player, not yet boarded, leaves its old Pilot too', () => {
    const mechs = pilotMechs(
      [{ id: 'hotdog', ownerId: null, boarded: false, mechId: 'mazona' }],
      ownerOf
    )
    expect(mechs.get('hotdog')).toBeNull()
  })

  test('a Pilot keeps its own assigned Mech, aboard or parked', () => {
    const mechs = pilotMechs(
      [
        { id: 'bonesaw', ownerId: null, boarded: false, mechId: 'scrapper' },
        { id: 'none', ownerId: 'priya', boarded: false, mechId: null },
      ],
      ownerOf
    )
    expect(mechs.get('bonesaw')).toBe('scrapper')
    expect(mechs.get('none')).toBeNull()
  })
})
