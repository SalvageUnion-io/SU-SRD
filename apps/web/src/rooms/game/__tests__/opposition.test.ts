import { describe, expect, test } from 'bun:test'
import { runAct } from '../acts'
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
    expect(room.opposition.runEncounter(MEDIATOR, encounter, { clear: false }, AT)).toEqual({
      added: 1,
    })
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
    room.opposition.runEncounter(MEDIATOR, encounter, { clear: true }, AT)
    expect(room.opposition.tray(MEDIATOR).map((n) => n.name)).toEqual(['Raider'])
  })
})

// MD6-01: the hand-over dialog says the new Mediator starts with empty notes.
describe('handing the table over mid-encounter (r6 B1)', () => {
  test('the running encounter goes across without its private notes', () => {
    const { room } = table()
    room.opposition.runEncounter(
      MEDIATOR,
      { ...encounter, briefing: 'Dust on the ridge.' },
      { clear: false },
      AT
    )
    const c = { room, actor: ORGANIZER, gameId: 'g1', at: AT + 5 }
    expect(runAct(c, 'setMediator', { userId: PLAYER, mediator: true }).ok).toBe(true)
    expect(runAct(c, 'setMediator', { userId: MEDIATOR, mediator: false }).ok).toBe(true)
    const running = room.opposition.running(PLAYER)
    expect(running?.name).toBe('Ambush at the Gap')
    expect(running?.notes).toBe('')
    // The briefing is the table's to hear, and the fight stays on the field.
    expect(running?.briefing).toBe('Dust on the ridge.')
    expect(room.opposition.tray(PLAYER).map((n) => n.name)).toEqual(['Raider'])
  })

  test('appointing someone who already mediates keeps the notes', () => {
    const { room } = table()
    room.opposition.runEncounter(MEDIATOR, encounter, { clear: false }, AT)
    const c = { room, actor: ORGANIZER, gameId: 'g1', at: AT + 5 }
    expect(runAct(c, 'setMediator', { userId: MEDIATOR, mediator: true }).ok).toBe(true)
    expect(room.opposition.running(MEDIATOR)?.notes).toBe('They come from the ridge.')
  })
})

// MD6-06: three Raiders run together were never a group, so its Morale prompt never came.
describe('units fielded in one go (r6 B5)', () => {
  test('two or more of one kind in no group form one group', () => {
    const { room } = table()
    const raiders = {
      ...encounter,
      opposition: ['o1', 'o2', 'o3'].map((id) => ({ ...encounter.opposition[0], id })),
    }
    room.opposition.runEncounter(MEDIATOR, raiders, { clear: false }, AT)
    const groups = room.opposition
      .tray(MEDIATOR)
      .map((n) => (n.group as { id: string; name: string } | undefined) ?? null)
    expect(groups.every((g) => g !== null && g.id === groups[0]?.id)).toBe(true)
    expect(groups[0]?.name).toBe('Raider')
  })
})

describe('the order it was prepped in (MD3-05)', () => {
  test('an encounter arrives in its own order, however its ids sort', () => {
    const { room } = table()
    const names = Array.from({ length: 12 }, (_, i) => `Unit ${String.fromCharCode(76 - i)}`)
    const prepped = {
      ...encounter,
      opposition: names.map((name, i) => ({ ...encounter.opposition[0], id: `o${i}`, name })),
    }
    room.opposition.runEncounter(MEDIATOR, prepped, { clear: false }, AT)
    expect(room.opposition.tray(MEDIATOR).map((n) => n.name)).toEqual(names)
    expect(room.opposition.trayRecords(MEDIATOR).map((r) => r.body.name)).toEqual(names)
  })
})

describe('waves and groups', () => {
  const grouped = {
    ...encounter,
    groups: [
      { id: 'gA', name: 'Ridge', wave: 1 },
      { id: 'gB', name: 'Relief', wave: 2 },
    ],
    opposition: [
      { ...encounter.opposition[0], id: 'o1', groupId: 'gA' },
      { ...encounter.opposition[0], id: 'o2', groupId: 'gA' },
      { ...encounter.opposition[0], id: 'o3', groupId: 'gB' },
    ],
  }
  const roll = { table: 'reaction', roll: 12, value: 'Wary', rolledAt: new Date(AT).toISOString() }

  test('the first wave is fielded, the rest wait until the Mediator brings them in', () => {
    const { room } = table()
    expect(
      room.opposition.runEncounter(MEDIATOR, grouped, { clear: false, waves: true }, AT)
    ).toEqual({ added: 2 })
    expect(room.opposition.running(MEDIATOR)?.held).toHaveLength(1)
    expect(room.opposition.bringInWave(MEDIATOR, 2, AT)).toEqual({ added: 1 })
    expect(room.opposition.running(MEDIATOR)?.held).toBeUndefined()
    // Copies fielded together are numbered from 1 (r4 D5); a later wave counts on.
    expect(room.opposition.tray(MEDIATOR).map((n) => n.name)).toEqual([
      'Raider 1',
      'Raider 2',
      'Raider 3',
    ])
    expect(() => room.opposition.bringInWave(MEDIATOR, 2, AT)).toThrow('already in')
    expect(() => room.opposition.bringInWave(PLAYER, 2, AT)).toThrow('Only the Mediator')
  })

  test('a group roll is kept on each member still standing', () => {
    const { room } = table()
    room.opposition.runEncounter(MEDIATOR, grouped, { clear: false, waves: true }, AT)
    const [first] = room.opposition.trayRecords(MEDIATOR)
    room.opposition.updateNpc(MEDIATOR, first?.appId ?? '', { currentHp: 0 }, AT)
    room.opposition.recordGroupRoll(MEDIATOR, 'gA', roll, AT)
    expect(room.opposition.tray(MEDIATOR).map((n) => n.lastMediatorRoll)).toEqual([undefined, roll])
  })

  test('a wreck is salvaged once, and only once it is down', () => {
    const { room } = table()
    const id = room.opposition.addNpc(MEDIATOR, { name: 'Raider', currentHp: 2, maxHp: 4 }, AT)
    expect(() => room.opposition.updateNpc(MEDIATOR, id, { salvaged: true }, AT)).toThrow(
      'downed wreck'
    )
    room.opposition.updateNpc(MEDIATOR, id, { currentHp: 0, salvaged: true }, AT)
    expect(() => room.opposition.updateNpc(MEDIATOR, id, { salvaged: true }, AT)).toThrow(
      'already salvaged'
    )
  })

  test('a wreck keeps its Mech Salvage roll until it is salvaged (r5 B1)', () => {
    const { room } = table()
    const id = room.opposition.addNpc(MEDIATOR, { name: 'Scrapper', currentHp: 2, maxHp: 4 }, AT)
    const rolled = { roll: 6, rolledAt: new Date(AT).toISOString() }
    expect(() => room.opposition.updateNpc(MEDIATOR, id, { salvageRoll: rolled }, AT)).toThrow(
      'downed wreck'
    )
    room.opposition.updateNpc(MEDIATOR, id, { currentHp: 0, salvageRoll: rolled }, AT)
    expect(room.opposition.tray(MEDIATOR)[0]?.salvageRoll).toEqual(rolled)
    // Rolled again, the new roll replaces the old.
    room.opposition.updateNpc(MEDIATOR, id, { salvageRoll: { ...rolled, roll: 12 } }, AT)
    expect(room.opposition.tray(MEDIATOR)[0]?.salvageRoll).toEqual({ ...rolled, roll: 12 })
    expect(() =>
      room.opposition.updateNpc(MEDIATOR, id, { salvageRoll: { roll: 21, rolledAt: 'x' } }, AT)
    ).toThrow()
    room.opposition.updateNpc(MEDIATOR, id, { salvaged: true }, AT)
    expect(() => room.opposition.updateNpc(MEDIATOR, id, { salvageRoll: rolled }, AT)).toThrow(
      'already salvaged'
    )
  })

  test('only the Mediator is served the running encounter, which marks them as mediating', () => {
    const { room } = table()
    expect(room.opposition.mediatorRecords(PLAYER)).toEqual([])
    expect(room.opposition.mediatorRecords(MEDIATOR)).toEqual([
      { appId: 'mediator', body: { running: null }, updatedAt: 0 },
    ])
    room.opposition.runEncounter(MEDIATOR, encounter, { clear: false }, AT)
    expect(room.opposition.mediatorRecords(MEDIATOR)[0]?.body.running?.name).toBe(
      'Ambush at the Gap'
    )
  })
})

describe('clearing the field (MD-19)', () => {
  test('Clear the field empties the tray in one act, the Mediator’s alone', () => {
    const { room } = table()
    room.opposition.addNpc(MEDIATOR, { name: 'Raider' }, AT)
    room.opposition.addNpc(MEDIATOR, { name: 'Raider 2' }, AT)
    expect(() => room.opposition.clearTray(PLAYER)).toThrow('Only the Mediator')
    expect(room.opposition.clearTray(MEDIATOR)).toEqual({ removed: 2 })
    expect(room.opposition.tray(MEDIATOR)).toEqual([])
  })

  test('ending an encounter may clear the field with it; by default it stays', () => {
    const { room } = table()
    room.opposition.runEncounter(MEDIATOR, encounter, { clear: false }, AT)
    room.opposition.endEncounter(MEDIATOR)
    expect(room.opposition.tray(MEDIATOR)).toHaveLength(1)
    room.opposition.runEncounter(MEDIATOR, encounter, { clear: false }, AT)
    room.opposition.endEncounter(MEDIATOR, { clear: true })
    expect(room.opposition.running(MEDIATOR)).toBeNull()
    expect(room.opposition.tray(MEDIATOR)).toEqual([])
  })
})
