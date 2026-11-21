import { describe, expect, test } from 'bun:test'
import { EMPTY_GAME_PLAN } from 'game-domain/schemas/gamePlan'
import {
  addSession,
  datedSessions,
  gameEncounters,
  gamePrepPath,
  heldSessions,
  lastOrder,
  looseEncounters,
  moveEncounter,
  patchSession,
  removeSession,
  sessionName,
} from '../gamePrep.model'

const e = (
  id: string,
  gameId?: string,
  order?: number,
  createdAt = `2026-01-0${id.length}T00:00:00.000Z`
) => ({
  id,
  createdAt,
  ...(gameId === undefined ? {} : { gameId }),
  ...(order === undefined ? {} : { order }),
})

describe("a Game's encounters (MD-14)", () => {
  const all = [e('a', 'g1', 2), e('bb', 'g1'), e('c', 'g2', 1), e('d'), e('f', 'g1', 1)]

  test('are the ones prepared for it, in their order, unordered ones last', () => {
    expect(gameEncounters(all, 'g1').map((x) => x.id)).toEqual(['f', 'a', 'bb'])
    expect(looseEncounters(all).map((x) => x.id)).toEqual(['d'])
    expect(lastOrder(gameEncounters(all, 'g1'))).toBe(3)
    expect(lastOrder([])).toBe(1)
  })

  test('moving one renumbers only what changed place', () => {
    const inGame = gameEncounters(all, 'g1')
    expect(moveEncounter(inGame, 'a', -1)).toEqual([
      { id: 'a', order: 1 },
      { id: 'f', order: 2 },
      { id: 'bb', order: 3 },
    ])
    expect(moveEncounter(inGame, 'f', -1)).toEqual([])
    expect(moveEncounter(inGame, 'bb', 1)).toEqual([])
    expect(moveEncounter(inGame, 'nope', 1)).toEqual([])
  })

  test('its Prep has its own address', () => {
    expect(gamePrepPath('g1')).toBe('/games/g1/prep')
  })
})

describe('the sessions list', () => {
  test('a session is added, changed, listed by its day and removed', () => {
    let plan = addSession(EMPTY_GAME_PLAN, 's1', '2026-12-08')
    plan = addSession(plan, 's2', '2026-12-01')
    plan = patchSession(plan, 's1', { title: 'The crossing', note: 'Ambush at dusk.' })
    expect(datedSessions(plan).map((s) => s.id)).toEqual(['s2', 's1'])
    expect(sessionName(plan.sessions[0] ?? {})).toBe('The crossing')
    // A blank day is unset, and an undated session lists last.
    plan = patchSession(plan, 's2', { date: '', title: ' ' })
    expect(plan.sessions[1]).toEqual({ id: 's2', note: '' })
    expect(datedSessions(plan).map((s) => s.id)).toEqual(['s1', 's2'])
    expect(sessionName(plan.sessions[1] ?? {})).toBe('Session')
    expect(removeSession(plan, 's1').sessions.map((s) => s.id)).toEqual(['s2'])
  })

  test('a held order keeps a re-dated session where it was; a new one follows', () => {
    let plan = addSession(EMPTY_GAME_PLAN, 's1', '2026-12-01')
    plan = addSession(plan, 's2', '2026-12-08')
    const held = datedSessions(plan).map((s) => s.id)
    plan = patchSession(plan, 's1', { date: '2026-12-20' })
    expect(heldSessions(plan, held).map((s) => s.id)).toEqual(['s1', 's2'])
    expect(heldSessions(plan, null).map((s) => s.id)).toEqual(['s2', 's1'])
    plan = addSession(plan, 's3', '2026-11-01')
    expect(heldSessions(plan, held).map((s) => s.id)).toEqual(['s1', 's2', 's3'])
  })
})
