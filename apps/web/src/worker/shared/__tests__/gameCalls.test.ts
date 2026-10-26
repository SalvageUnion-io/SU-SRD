import { describe, expect, test } from 'bun:test'
import { applyOp } from 'game-domain/ops/applyOp'
import { bunSql } from '../../../rooms/__tests__/bunSql'
import type { GameActName } from '../../../rooms/game/acts'
import { runAct } from '../../../rooms/game/acts'
import { GameRoomLogic } from '../../../rooms/game/gameRoomLogic'
import { migrate } from '../../../rooms/migrate'
import { gamePublished } from '../../../rooms/publish'
import { GAME_ROOM } from '../../../rooms/schemas'
import type { GameRoomStub } from '../../rooms'
import type { CallDeps } from '../gameCalls'
import { gameCall } from '../gameCalls'
import { RoomPublisher } from '../roomRows'
import { testDb } from './d1'

/**
 * The Games calls over real Game room logic and the shared database in
 * memory: each room a `GameRoomLogic`, its shared rows written as the
 * Durable Object's publisher writes them.
 */

const ORG = { discordId: 'd-org', accountId: 'a-org' }
const PLAYER = { discordId: 'd-player', accountId: 'a-player' }

function world() {
  const db = testDb()
  db.sqlite.exec(
    'create table accounts (account_id text, discord_id text, display_name text, name text, avatar_url text)'
  )
  db.sqlite.exec(
    "insert into accounts values ('a-org', 'd-org', 'Org', null, null), ('a-player', 'd-player', null, 'Rosa', null)"
  )
  const games = new Map<string, GameRoomStub>()
  let ids = 0
  const game = (gameId: string): GameRoomStub => {
    const known = games.get(gameId)
    if (known !== undefined) return known
    const sql = bunSql()
    migrate(sql, GAME_ROOM)
    const logic = new GameRoomLogic(sql, { applyOp })
    const publisher = new RoomPublisher(db, `game:${gameId}`, null, () =>
      gamePublished(logic.store, gameId)
    )
    const stub = {
      act: async (actor: string, name: GameActName, args: never) =>
        runAct({ room: logic, actor, gameId, at: Date.now() }, name, args),
      republish: () => publisher.republish(),
    } as unknown as GameRoomStub
    games.set(gameId, stub)
    return stub
  }
  const deps: CallDeps = {
    db,
    game,
    account: () => ({ unit: async () => null }) as never,
    bot: {},
    newId: () => `id-${++ids}`,
    fetch: (() => Promise.reject(new Error('no network'))) as never,
  }
  const call = async (
    name: string,
    args: object,
    who: typeof ORG | null = ORG
  ): Promise<unknown> => {
    const answer = await gameCall(name, args, who, deps)
    if (answer === null || !answer.ok) throw new Error(JSON.stringify(answer))
    return answer.value
  }
  return { db, deps, call }
}

describe('the Games calls', () => {
  test('a new Game is listed, its invite joins a player, and its roster names them', async () => {
    const { call, deps } = world()
    const gameId = (await call('games.create', { name: ' Tenacity ' })) as string
    expect(await call('games.listMine', {})).toEqual([
      expect.objectContaining({ _id: gameId, name: 'Tenacity', organizer: true, memberCount: 1 }),
    ])
    const code = (await call('invites.link', { gameId })) as string
    expect(await call('invites.preview', { code: code.toLowerCase() }, null)).toEqual({
      gameName: 'Tenacity',
      invitedBy: 'Org',
    })
    expect(await call('invites.redeem', { code }, PLAYER)).toEqual({ kind: 'joined', gameId })
    expect(await call('games.listMine', {}, PLAYER)).toEqual([
      expect.objectContaining({ _id: gameId, organizer: false }),
    ])
    const members = (await call('games.members', {
      gameId,
    })) as { userId: string; displayName: string }[]
    expect(members.map((m) => [m.userId, m.displayName])).toEqual([
      ['d-org', 'Org'],
      ['d-player', 'Rosa'],
    ])
    await call('games.setMediator', { gameId, userId: 'd-player', mediator: true })
    expect(await call('games.get', { gameId }, PLAYER)).toMatchObject({ mediator: true })
    const reset = await gameCall('invites.reset', { gameId }, PLAYER, deps)
    expect(reset).toEqual({ ok: false, refusal: 'Only the Organiser can do that' })
  })

  test('a Game from the Starter Set lists its crew unassigned, aboard its crawler', async () => {
    const { call } = world()
    const templates = (await call('templates.list', {}, null)) as { id: string }[]
    const gameId = (await call('templates.createGame', { templateId: templates[0]?.id })) as string
    const listed = (await call('entities.listForGame', { gameId })) as {
      pilots: { ownerId: string | null }[]
      crawlers: { _id: string }[]
      softLinks: { type: string }[]
      primaryCrawlerId: string
    }
    expect(listed.pilots).toHaveLength(6)
    expect(listed.pilots.every((p) => p.ownerId === null)).toBe(true)
    expect(listed.primaryCrawlerId).toBe(listed.crawlers[0]?._id as string)
    expect(listed.softLinks.filter((l) => l.type === 'pilot-to-crawler')).toHaveLength(6)
    expect(await call('entities.listForGame', { gameId }, PLAYER)).toMatchObject({ pilots: [] })
  })

  test('signed out, only the preview and the templates answer; an unknown call is none', async () => {
    const { deps } = world()
    expect(await gameCall('games.listMine', {}, null, deps)).toEqual({
      ok: false,
      refusal: 'Sign in first',
    })
    expect(await gameCall('games.nope', {}, ORG, deps)).toBeNull()
    expect(await gameCall('invites.redeem', { code: 'NOPE' }, ORG, deps)).toEqual({
      ok: false,
      refusal: 'That invite link is not valid',
    })
  })
})
