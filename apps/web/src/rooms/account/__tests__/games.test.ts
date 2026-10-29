import { describe, expect, test } from 'bun:test'
import { bunSql } from '../../__tests__/bunSql'
import { AT, PLAYER, stubApplyOp } from '../../game/__tests__/harness'
import { migrate } from '../../migrate'
import { ACCOUNT_ROOM } from '../../schemas'
import { AccountRoomLogic } from '../accountRoomLogic'

function room() {
  const sql = bunSql()
  migrate(sql, ACCOUNT_ROOM)
  return new AccountRoomLogic(sql, { applyOp: stubApplyOp })
}

describe('the Games an account room keeps', () => {
  test('a join is noted once, at its first time, and a Game that ends drops out', () => {
    const { games } = room()
    games.joined('g-2', AT + 1)
    games.joined('g-1', AT)
    games.joined('g-2', AT + 5)
    expect(games.list()).toEqual(['g-1', 'g-2'])
    games.left('g-1')
    games.left('g-unknown')
    expect(games.list()).toEqual(['g-2'])
  })

  test('a claimed room seeds once from the shared database, keeping what it noted', () => {
    const logic = room()
    expect(logic.games.needsSeed()).toBe(false)
    logic.shelf.claim(PLAYER, AT)
    logic.games.joined('g-new', AT)
    expect(logic.games.needsSeed()).toBe(true)
    logic.games.seed(['g-old', 'g-new'], AT + 1)
    expect(logic.games.needsSeed()).toBe(false)
    expect(logic.games.list()).toEqual(['g-new', 'g-old'])
  })

  test('a room migrated from before the list keeps its player and seeds', () => {
    const sql = bunSql()
    migrate(sql, ACCOUNT_ROOM.slice(0, 4))
    sql.exec("insert into account (id, discord_id, created_at) values (1, 'd-old', 1)")
    migrate(sql, ACCOUNT_ROOM)
    const logic = new AccountRoomLogic(sql, { applyOp: stubApplyOp })
    expect(logic.shelf.owner()).toBe('d-old')
    expect(logic.games.list()).toEqual([])
    expect(logic.games.needsSeed()).toBe(true)
  })
})
