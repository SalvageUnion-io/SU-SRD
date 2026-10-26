import { describe, expect, test } from 'bun:test'
import { BOT_RELAY_POST_ROLL_PATH } from 'game-domain/botWire'
import { applyOp } from 'game-domain/ops/applyOp'
import { bunSql } from '../../../rooms/__tests__/bunSql'
import type { GameActName } from '../../../rooms/game/acts'
import { runAct } from '../../../rooms/game/acts'
import { GameRoomLogic } from '../../../rooms/game/gameRoomLogic'
import { migrate } from '../../../rooms/migrate'
import { gamePublished } from '../../../rooms/publish'
import { RoomRefusal } from '../../../rooms/refusal'
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

function world(over: Partial<CallDeps> = {}) {
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
      // The room's own disband also delivers each unit home; here it only ends the Game.
      disband: async (actor: string) => {
        try {
          logic.roster.disband(actor, Date.now())
          return { ok: true, value: null }
        } catch (error) {
          if (error instanceof RoomRefusal) return { ok: false, refusal: error.message }
          throw error
        }
      },
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
    ...over,
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
  return { db, deps, call, game }
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

type Listed = {
  pilots: { _id: string; ownerId: string | null; body: Record<string, unknown> }[]
  crawlers: { _id: string }[]
}

/** A Starter Set Game the Organiser runs, with the player joined. */
async function starterGame(w: ReturnType<typeof world>) {
  const gameId = (await w.call('templates.createGame', { templateId: 'starter-set' })) as string
  await w.call('invites.redeem', { code: await w.call('invites.link', { gameId }) }, PLAYER)
  const listed = (await w.call('entities.listForGame', { gameId })) as Listed
  return { gameId, listed }
}

describe('who holds what in a Game', () => {
  test('assign, reassign, unassign and remove a unit; the primary crawler; ending the Game', async () => {
    const w = world()
    const { gameId, listed } = await starterGame(w)
    const [pilot, other] = listed.pilots
    const crawler = listed.crawlers[0]?._id as string
    const ownerOf = async (id: string | undefined) =>
      ((await w.call('entities.listForGame', { gameId })) as Listed).pilots.find(
        (p) => p._id === id
      )?.ownerId
    await w.call('ownership.assign', { gameId, entityId: pilot?._id })
    expect(await ownerOf(pilot?._id)).toBe('d-org')
    await w.call('ownership.unassign', { gameId, entityId: pilot?._id })
    expect(await ownerOf(pilot?._id)).toBeNull()
    await w.call('ownership.assign', { gameId, entityId: other?._id, userId: 'd-player' })
    expect(await ownerOf(other?._id)).toBe('d-player')
    await w.call('ownership.assign', { gameId, entityId: pilot?._id })
    expect(await w.call('entities.remove', { gameId, entityId: pilot?._id })).toBeNull()
    expect(await ownerOf(pilot?._id)).toBeUndefined()
    expect(await w.call('games.setPrimaryCrawler', { gameId, crawlerId: crawler })).toBeNull()
    expect(await w.call('entities.removeCrawler', { gameId, crawlerId: crawler })).toBeNull()
    expect(await w.call('entities.listForGame', { gameId })).toMatchObject({ crawlers: [] })
    expect(await w.call('invites.reset', { gameId })).toEqual(expect.any(String))
    expect(await gameCall('games.destroy', { gameId }, PLAYER, w.deps)).toEqual({
      ok: false,
      refusal: expect.any(String),
    })
    expect(await w.call('games.destroy', { gameId })).toBeNull()
  })
})

describe('where a unit is, and a move between rooms', () => {
  const shelf = (calls: string[], accept: () => void = () => {}) => ({
    unit: async (_actor: string, id: string) => (id === 'shelf-1' ? { id, kind: 'pilot' } : null),
    offer: async () => {
      calls.push('offer')
      return { unitId: 'shelf-1' }
    },
    accept: async () => {
      calls.push('accept')
      accept()
    },
    release: async () => {
      calls.push('release')
    },
    cancel: async () => {
      calls.push('cancel')
    },
    refuseLease: async () => {
      calls.push('refuseLease')
      return 'refused'
    },
  })

  test('a unit on the shelf, in a Game, or nowhere the player can see', async () => {
    const w = world({ account: () => shelf([]) as never })
    const { gameId, listed } = await starterGame(w)
    const pilot = listed.pilots[0]?._id as string
    const crawler = listed.crawlers[0]?._id as string
    expect(await w.call('entities.locate', { kind: 'pilot', id: 'shelf-1' })).toEqual({
      id: 'shelf-1',
      gameId: null,
      mayEdit: true,
    })
    expect(await w.call('entities.locate', { kind: 'pilot', id: pilot })).toEqual({
      id: pilot,
      gameId,
      mayEdit: false,
    })
    expect(await w.call('entities.locate', { kind: 'crawler', id: crawler })).toMatchObject({
      mayEdit: true,
    })
    expect(await w.call('entities.locate', { kind: 'crawler', id: crawler }, PLAYER)).toMatchObject(
      { mayEdit: false }
    )
    expect(await w.call('entities.locate', { kind: 'mech', id: 'shelf-1' })).toBeNull()
  })

  test('a move is one handoff; to where it already is, nothing', async () => {
    const calls: string[] = []
    const base = world()
    const w = world({
      account: () => shelf(calls) as never,
      game: (id) => ({ ...base.game(id), ...shelf(calls) }) as never,
    })
    const move = (gameId: string | null, appId = 'shelf-1') =>
      gameCall('entities.move', { kind: 'pilot', appId, gameId }, ORG, w.deps)
    expect(await move(null, 'gone')).toEqual({
      ok: false,
      refusal: 'That build could not be found',
    })
    expect(await move(null)).toEqual({ ok: true, value: null })
    expect(calls).toEqual([])
    expect(await move('g-1')).toEqual({ ok: true, value: null })
    expect(calls).toEqual(['offer', 'accept', 'release'])
  })

  test('a refusal across the handoff keeps its words; a defect stays one', async () => {
    let failure = new Error('A crewmate holds that')
    failure.name = 'RoomRefusal'
    const calls: string[] = []
    const base = world()
    const w = world({
      account: () => shelf(calls) as never,
      game: (id) =>
        ({
          ...base.game(id),
          ...shelf(calls, () => {
            throw failure
          }),
        }) as never,
    })
    const move = () =>
      gameCall('entities.move', { kind: 'pilot', appId: 'shelf-1', gameId: 'g-1' }, ORG, w.deps)
    expect(await move()).toEqual({ ok: false, refusal: 'A crewmate holds that' })
    expect(calls).toEqual(['offer', 'accept', 'refuseLease', 'cancel'])
    failure = new Error('disk full')
    await expect(move()).rejects.toThrow('disk full')
  })
})

describe("Discord's channels", () => {
  const bind = (w: ReturnType<typeof world>, channelId: string, gameId: string | null) =>
    w.db.sqlite
      .query('insert into channel_bindings values (?1, ?2, ?3, ?4, 5)')
      .run(channelId, gameId, 'd-org', `#${channelId}`)
  const roll = { tableName: 'Core Mechanic', rolls: [17] }

  test('the player’s bindings, solo and per Game, and the current one', async () => {
    const w = world()
    const { gameId } = await starterGame(w)
    bind(w, 'c-solo', null)
    bind(w, 'c-game', gameId)
    expect(await w.call('channelBindings.mine', {})).toEqual({
      personal: { channelId: 'c-solo', channelName: '#c-solo', boundAt: 5 },
      games: [
        {
          gameId,
          gameName: expect.any(String),
          mayBind: true,
          binding: { channelId: 'c-game', channelName: '#c-game', boundAt: 5 },
        },
      ],
    })
    expect(await w.call('channelBindings.current', {})).toMatchObject({ channelId: 'c-solo' })
    expect(await w.call('channelBindings.current', { gameId })).toMatchObject({
      channelId: 'c-game',
    })
    expect(await w.call('channelBindings.current', {}, PLAYER)).toBeNull()
    expect(await w.call('channelBindings.current', { gameId: 'g-elsewhere' })).toBeNull()
  })

  test('a roll that is not posted, or cannot be', async () => {
    const w = world()
    const { gameId } = await starterGame(w)
    const post = (args: object, who = ORG) =>
      gameCall('channelBindings.postRoll', { roll, post: true, ...args }, who, w.deps)
    expect(await post({ post: false })).toEqual({ ok: true, value: { kind: 'skipped' } })
    expect(await post({ gameId: 'g-elsewhere' })).toEqual({
      ok: false,
      refusal: 'Not a member of this Game',
    })
    expect(await post({ gameId })).toEqual({ ok: true, value: { kind: 'unbound' } })
    bind(w, 'c-game', gameId)
    expect(await post({ gameId, roll: { tableName: 'Core Mechanic', rolls: [0] } })).toEqual({
      ok: true,
      value: { kind: 'failed', channelId: 'c-game', message: 'That roll cannot be posted.' },
    })
    expect(await post({ gameId })).toEqual({
      ok: true,
      value: { kind: 'failed', channelId: 'c-game', message: 'Posting to Discord is not set up.' },
    })
  })

  test('the bot posts it as the pilot, or says why not', async () => {
    const sent: { url: string; body: Record<string, unknown> }[] = []
    let reply: () => Promise<Response> = async () => Response.json({ ok: true, messageId: 'm-1' })
    const w = world({
      bot: { BOT_URL: 'https://bot.test/', BOT_SECRET: 's3cret' },
      fetch: (async (url: string, init: RequestInit) => {
        sent.push({ url, body: JSON.parse(init.body as string) })
        return reply()
      }) as never,
    })
    const { gameId, listed } = await starterGame(w)
    const pilot = listed.pilots[0]
    bind(w, 'c-game', gameId)
    bind(w, 'c-solo', null)
    const post = (args: object) =>
      gameCall('channelBindings.postRoll', { roll, post: true, ...args }, ORG, w.deps)
    expect(await post({ gameId, pilotId: pilot?._id })).toEqual({
      ok: true,
      value: { kind: 'posted', channelId: 'c-game', messageId: 'm-1' },
    })
    expect(sent[0]?.url).toBe(`https://bot.test${BOT_RELAY_POST_ROLL_PATH}`)
    expect(sent[0]?.body).toMatchObject({
      channelId: 'c-game',
      tableName: 'Core Mechanic',
      rolls: [17],
      roller: pilot?.body.callsign ?? pilot?.body.name,
      ownerDiscordId: 'd-org',
    })
    await post({})
    expect(sent[1]?.body).toMatchObject({ channelId: 'c-solo', roller: 'Org' })
    reply = async () => Response.json({ ok: false, message: 'Missing access' }, { status: 403 })
    expect(await post({})).toEqual({
      ok: true,
      value: { kind: 'failed', channelId: 'c-solo', message: 'Missing access' },
    })
    reply = async () => new Response('nope', { status: 502 })
    expect(await post({})).toMatchObject({ value: { message: 'The bot did not answer.' } })
    reply = () => Promise.reject(new Error('down'))
    expect(await post({})).toMatchObject({ value: { message: 'The bot could not be reached.' } })
  })
})
