import { describe, expect, test } from 'bun:test'
import { STARTER_PILOTS } from 'game-domain/starterSet/starterSet'
import { seedTemplate } from '../template'
import { AT, emptyRoom, ORGANIZER, profile } from './harness'

describe('starting a Game from a template', () => {
  function started(gameId = 'g1') {
    const { room } = emptyRoom(gameId)
    let n = 0
    const args = { gameId, templateId: 'starter-set', profile: profile('Org'), at: AT }
    seedTemplate(room, ORGANIZER, { ...args, newId: () => `${gameId}-u${++n}` })
    return { room, args }
  }

  test('the crew arrives unassigned, under fresh ids, aboard the template’s crawler', () => {
    const { room } = started()
    expect(room.roster.read(ORGANIZER)).toMatchObject({
      name: "Reclamation of the Wastes — Union Crawler #430 'Tenacity'",
      templateOrigin: 'starter-set',
      organizer: true,
      pilotCount: STARTER_PILOTS.length,
      mechCount: STARTER_PILOTS.length,
      crawlerName: "Crawler #430 'Tenacity'",
    })
    const units = room.store.units()
    expect(units.every((u) => u.ownerId === null)).toBe(true)
    expect(units.some((u) => u.id.startsWith('starter-'))).toBe(false)
    expect(units.every((u) => u.body.id === u.id)).toBe(true)
    const crawler = room.units.primaryCrawler()
    const aboard = room.store.links().filter((l) => l.type === 'pilot-to-crawler')
    expect(aboard).toHaveLength(STARTER_PILOTS.length)
    expect(aboard.every((l) => l.to.id === crawler?.id)).toBe(true)
  })

  test('a name of its own wins, starting again is a no-op, and an unknown template is refused', () => {
    const { room } = emptyRoom()
    const args = { gameId: 'g1', templateId: 'starter-set', profile: profile('Org'), at: AT }
    seedTemplate(room, ORGANIZER, { ...args, name: ' Our table ' })
    const count = room.store.units().length
    seedTemplate(room, ORGANIZER, args)
    expect(room.roster.read(ORGANIZER)?.name).toBe('Our table')
    expect(room.store.units()).toHaveLength(count)
    expect(() =>
      seedTemplate(emptyRoom().room, ORGANIZER, { ...args, templateId: 'nope' })
    ).toThrow('There is no such template')
  })
})
