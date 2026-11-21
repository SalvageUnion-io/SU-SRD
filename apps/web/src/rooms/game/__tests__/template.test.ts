import { describe, expect, test } from 'bun:test'
import { STARTER_PILOTS } from 'game-domain/starterSet/starterSet'
import { seedTemplate } from '../template'
import { AT, bodies, emptyRoom, ORGANIZER, profile } from './harness'

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

  // MD2-02: a template tried and deleted left thirteen loose units behind.
  test('deleting it can take the units nobody touched; one handed out or changed is always delivered', () => {
    const { room } = started()
    const all = room.store.units().length
    expect(room.roster.read(ORGANIZER)?.templateUnits).toEqual({ came: all, untouched: all })
    const [pilot] = room.store.units('pilot')
    if (pilot === undefined) throw new Error('no pilot')
    room.units.assign(ORGANIZER, pilot.id, AT + 1)
    room.units.create(ORGANIZER, {
      id: 'mine',
      kind: 'pilot',
      body: bodies.pilot('mine'),
      at: AT + 2,
    })
    // The pilot handed out took their mech with them: two are somebody's now.
    const held = room.store.units().filter((u) => u.ownerId === ORGANIZER && u.id !== 'mine')
    expect(held.map((u) => u.kind).sort()).toEqual(['mech', 'pilot'])
    expect(room.roster.read(ORGANIZER)?.templateUnits).toEqual({ came: all, untouched: all - 2 })

    const ended = room.roster.disband(ORGANIZER, AT + 3, { dropTemplateUnits: true })
    expect(ended.deliveries.map((d) => d.parcel.unit.id).sort()).toEqual(
      [...held.map((u) => u.id), 'mine'].sort()
    )
  })

  test('unasked, deleting it delivers every unit, as any Game does', () => {
    const { room } = started()
    expect(room.roster.disband(ORGANIZER, AT + 1).deliveries).toHaveLength(
      room.store.units().length
    )
  })

  // MD2-10: a template's pairs are handed out whole.
  test('a pilot handed to a member takes their free mech with them; a mech somebody holds stays', () => {
    const { room } = started()
    const pair = room.store.links().find((l) => l.type === 'mech-to-pilot')
    if (pair === undefined) throw new Error('no pair')
    room.units.assign(ORGANIZER, pair.to.id, AT + 1)
    expect(room.store.unit(pair.from.id)?.ownerId).toBe(ORGANIZER)
    room.units.unassign(ORGANIZER, pair.to.id, AT + 2)
    expect(room.store.unit(pair.from.id)?.ownerId).toBeNull()
    // Held apart, each is handed on its own.
    room.units.assign(ORGANIZER, pair.from.id, AT + 3)
    room.units.unassign(ORGANIZER, pair.to.id, AT + 4)
    expect(room.store.unit(pair.from.id)?.ownerId).toBe(ORGANIZER)
  })
})
