/**
 * The mechs Play offers to board (ADR-038 §3's boarding menu, §5): one test per disabled reason, the
 * order, and the edge states (no assigned mech, assigned mech destroyed, no crawler).
 */

import { describe, expect, test } from 'bun:test'
import { mechFixture } from '../../components/__tests__/fixtures'
import type { BoardSources, CrewLink, CrewRow } from '../boardMenu.model'
import { boardable, boardMenu } from '../boardMenu.model'

const ME = 'user-me'
const VEX_OWNER = 'user-vex'

function row(appId: string, ownerId: string | null, body: Record<string, unknown> = {}): CrewRow {
  return { _id: `row-${appId}`, appId, ownerId, body: { id: appId, name: appId, ...body } }
}

function link(type: string, from: string, to: string): CrewLink {
  const [fromType, toType] = type.split('-to-') as [string, string]
  return { type, from: { type: fromType, id: from }, to: { type: toType, id: to } }
}

/** Rook (mine) crews Hen; Vex (a crewmate's) too. */
const pilots = [row('rook', ME, { name: 'Rook' }), row('vex', VEX_OWNER, { name: 'Vex' })]
const crew = [link('pilot-to-crawler', 'rook', 'hen'), link('pilot-to-crawler', 'vex', 'hen')]
const onHen = (...ids: string[]) => ids.map((id) => link('mech-to-crawler', id, 'hen'))

const assigned = mechFixture({ id: 'thresher', name: 'thresher' })

/** Nothing read yet: the menu falls back to the assigned mech alone. */
const NO_BOARD_SOURCES: BoardSources = { listing: null, seats: [], viewerId: null }

function sources(
  mechs: CrewRow[],
  extra: Partial<{ links: CrewLink[]; seats: BoardSources['seats'] }> = {}
): BoardSources {
  return {
    listing: {
      pilots,
      mechs,
      softLinks: extra.links ?? [...crew, ...onHen(...mechs.map((m) => m.appId ?? ''))],
    },
    seats: extra.seats ?? [],
    viewerId: ME,
  }
}

function menuFor(mechs: CrewRow[], extra: Parameters<typeof sources>[1] = {}, mech = assigned) {
  return boardMenu({ pilotId: 'rook', assigned: mech, sources: sources(mechs, extra) })
}

function option(menu: ReturnType<typeof boardMenu>, mechId: string) {
  const found = menu.find((o) => o.mechId === mechId)
  if (found === undefined) throw new Error(`${mechId} is not listed`)
  return found
}

describe('each state', () => {
  test('your own mech boards', () => {
    const o = option(menuFor([row('thresher', ME)]), 'thresher')
    expect(o).toMatchObject({ state: 'yours', note: null, serverId: 'row-thresher' })
    expect(boardable(o)).toBe(true)
  })

  test('an unclaimed spare is claimed, then boarded', () => {
    const o = option(menuFor([row('thresher', ME), row('spare', null)]), 'spare')
    expect(o).toMatchObject({ state: 'spare', note: 'Unclaimed spare', serverId: 'row-spare' })
    expect(boardable(o)).toBe(true)
  })

  test("another player's mech is disabled", () => {
    const o = option(menuFor([row('thresher', ME), row('hauler', VEX_OWNER)]), 'hauler')
    expect(o).toMatchObject({ state: 'others', note: 'Another player’s mech' })
    expect(boardable(o)).toBe(false)
  })

  test('a destroyed mech is disabled', () => {
    const o = option(menuFor([row('thresher', ME), row('wreck', ME, { destroyed: true })]), 'wreck')
    expect(o).toMatchObject({ state: 'destroyed', note: 'Destroyed' })
    expect(boardable(o)).toBe(false)
  })

  test('a mech another seat is boarded in is disabled, naming who', () => {
    const menu = menuFor([row('thresher', ME), row('hauler', VEX_OWNER)], {
      seats: [{ pilotId: 'vex', mount: { kind: 'boarded', mechId: 'hauler' } }],
    })
    expect(option(menu, 'hauler')).toMatchObject({ state: 'aboard', note: 'Vex is aboard' })
    expect(boardable(option(menu, 'hauler'))).toBe(false)
  })

  test("the pilot's own seat is not another seat", () => {
    const menu = menuFor([row('thresher', ME)], {
      seats: [{ pilotId: 'rook', mount: { kind: 'boarded', mechId: 'thresher' } }],
    })
    expect(option(menu, 'thresher').state).toBe('yours')
  })
})

describe('what is listed, and in what order', () => {
  test("every mech on the pilot's crawler, the pilot's own first", () => {
    const menu = menuFor([
      row('hauler', VEX_OWNER),
      row('spare', null),
      row('mine-too', ME),
      row('thresher', ME),
    ])
    expect(menu.map((o) => o.mechId)).toEqual(['thresher', 'mine-too', 'hauler', 'spare'])
  })

  test('a mech on another crawler is not listed', () => {
    const menu = menuFor([row('thresher', ME), row('elsewhere', ME)], {
      links: [...crew, ...onHen('thresher'), link('mech-to-crawler', 'elsewhere', 'other')],
    })
    expect(menu.map((o) => o.mechId)).toEqual(['thresher'])
  })

  test('with no crawler, only your own mechs are listed', () => {
    const menu = menuFor(
      [row('thresher', ME), row('mine-too', ME), row('hauler', VEX_OWNER), row('spare', null)],
      { links: [] }
    )
    expect(menu.map((o) => o.mechId)).toEqual(['thresher', 'mine-too'])
  })
})

describe('the assigned mech', () => {
  test('is listed first', () => {
    expect(menuFor([row('thresher', ME)])[0]).toMatchObject({
      mechId: 'thresher',
      state: 'yours',
    })
  })

  test('no assigned mech: the crawler’s mechs are still listed', () => {
    const menu = boardMenu({
      pilotId: 'rook',
      assigned: null,
      sources: sources([row('spare', null), row('mine', ME)]),
    })
    expect(menu.map((o) => o.mechId)).toEqual(['mine', 'spare'])
  })

  test('assigned mech destroyed: it carries the reason, and spares are still offered', () => {
    const menu = menuFor([row('thresher', ME, { destroyed: true }), row('spare', null)])
    expect(option(menu, 'thresher')).toMatchObject({ state: 'destroyed', note: 'Destroyed' })
    expect(boardable(option(menu, 'spare'))).toBe(true)
  })

  test('before the Game answers, the assigned mech alone, from the local store', () => {
    const menu = boardMenu({ pilotId: 'rook', assigned, sources: NO_BOARD_SOURCES })
    expect(menu).toHaveLength(1)
    expect(menu[0]).toMatchObject({ mechId: 'thresher', state: 'yours', serverId: null })

    const wreck = { ...assigned, destroyed: true }
    expect(
      boardMenu({ pilotId: 'rook', assigned: wreck, sources: NO_BOARD_SOURCES })[0]
    ).toMatchObject({ state: 'destroyed' })
  })
})
