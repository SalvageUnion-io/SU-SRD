import { describe, expect, test } from 'bun:test'
import { mechFixture, softLinkFixture } from '../../components/__tests__/fixtures'
import { situationOf, soloMechOptions } from '../situation.model'

describe('situationOf', () => {
  test('the mount decides On foot or Boarded', () => {
    expect(situationOf(false, { kind: 'foot' })).toBe('onFoot')
    expect(situationOf(false, { kind: 'boarded', mechId: 'm' })).toBe('boarded')
  })

  test('Downtime, while it runs, wins over the mount', () => {
    expect(situationOf(true, { kind: 'boarded', mechId: 'm' })).toBe('downtime')
    expect(situationOf(true, { kind: 'foot' })).toBe('downtime')
  })
})

describe('soloMechOptions', () => {
  const links = [softLinkFixture('mech-to-pilot', 'buzzard', 'bonesaw')]

  test('the shelf’s mechs, the assigned one first; a Game’s mechs are not offered', () => {
    const options = soloMechOptions(
      'bonesaw',
      [
        mechFixture({ id: 'faithful', name: 'Old Faithful' }),
        mechFixture({ id: 'buzzard', name: 'Buzzard' }),
        mechFixture({ id: 'atlas', name: 'Atlas', gameId: 'g1' }),
      ],
      links
    )
    expect(options.map((o) => o.name)).toEqual(['Buzzard', 'Old Faithful'])
    expect(options.every((o) => o.state === 'yours' && o.note === null)).toBe(true)
  })

  test('a destroyed mech is listed with its reason', () => {
    const [wreck] = soloMechOptions(
      'bonesaw',
      [mechFixture({ id: 'wreck', name: 'Wreck', destroyed: true })],
      links
    )
    expect(wreck).toMatchObject({ state: 'destroyed', note: 'Destroyed' })
  })
})
