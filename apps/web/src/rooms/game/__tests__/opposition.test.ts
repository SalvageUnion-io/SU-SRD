import { describe, expect, test } from 'bun:test'
import { AT, MEDIATOR, ORGANIZER, PLAYER, table } from './harness'

const encounter = {
  id: 'e1',
  schemaVersion: 1,
  name: 'Ambush at the Gap',
  opposition: [
    {
      id: 'o1',
      refSchema: 'npcs',
      refSlug: 'raider',
      refName: 'Raider',
      name: 'Raider',
      maxHp: 4,
      statKind: 'hp',
    },
  ],
  tables: [],
  notes: 'They come from the ridge.',
  createdAt: new Date(AT).toISOString(),
  updatedAt: new Date(AT).toISOString(),
}

describe('the Opposition tray', () => {
  test('is the Mediator’s alone, to read and to write', () => {
    const { room } = table()
    expect(() => room.opposition.addNpc(PLAYER, { name: 'Raider' }, AT)).toThrow(
      'Only the Mediator'
    )
    const id = room.opposition.addNpc(MEDIATOR, { name: 'Raider', currentHp: 5, maxHp: 6 }, AT)
    expect(room.opposition.tray(PLAYER)).toEqual([])
    expect(room.opposition.tray(ORGANIZER)).toEqual([])
    room.opposition.updateNpc(MEDIATOR, id, { currentHp: 40, name: ' Raider Boss ' }, AT)
    expect(room.opposition.tray(MEDIATOR)).toEqual([
      { id, name: 'Raider Boss', currentHp: 6, maxHp: 6 },
    ])
    expect(() => room.opposition.updateNpc(MEDIATOR, id, { name: '' }, AT)).toThrow('needs a name')
    room.opposition.removeNpc(MEDIATOR, id)
    expect(() => room.opposition.updateNpc(MEDIATOR, id, {}, AT)).toThrow('no longer on the tray')
  })

  test('a body outside the schema is refused', () => {
    const { room } = table()
    expect(() => room.opposition.addNpc(MEDIATOR, { name: 'X', secret: 1 }, AT)).toThrow()
  })
})

describe('running an encounter', () => {
  test('its notes become the running encounter until it ends; the tray stays', () => {
    const { room } = table()
    room.opposition.addNpc(MEDIATOR, { name: 'Raider' }, AT)
    expect(room.opposition.runEncounter(MEDIATOR, encounter, false, AT)).toEqual({ added: 1 })
    // Fielded at full HP, named apart from the Raider already there.
    expect(room.opposition.tray(MEDIATOR).map((n) => [n.name, n.currentHp])).toEqual([
      ['Raider', undefined],
      ['Raider 2', 4],
    ])
    expect(room.opposition.running(MEDIATOR)).toMatchObject({ name: 'Ambush at the Gap' })
    expect(room.opposition.running(PLAYER)).toBeNull()
    room.opposition.endEncounter(MEDIATOR)
    expect(room.opposition.running(MEDIATOR)).toBeNull()
    expect(room.opposition.tray(MEDIATOR)).toHaveLength(2)
    room.opposition.runEncounter(MEDIATOR, encounter, true, AT)
    expect(room.opposition.tray(MEDIATOR).map((n) => n.name)).toEqual(['Raider'])
  })
})
