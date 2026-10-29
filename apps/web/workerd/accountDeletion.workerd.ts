import type { D1Migration } from 'cloudflare:test'
import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { GameRoomStub } from '../src/worker/roomStubs'
import { rooms } from '../src/worker/roomStubs'
import { deleteRoomAccount } from '../src/worker/shared/accountDeletion'
import type { SharedDb } from '../src/worker/shared/db'
import type { CallDeps } from '../src/worker/shared/gameCalls'
import { gameCall } from '../src/worker/shared/gameCalls'

const { SHARED, TEST_MIGRATIONS } = env as unknown as {
  SHARED: D1Database
  TEST_MIGRATIONS: D1Migration[]
}

beforeAll(() => applyD1Migrations(SHARED, TEST_MIGRATIONS))

const db = SHARED as unknown as SharedDb
const game = (gameId: string) => rooms().GameRoom.getByName(gameId) as unknown as GameRoomStub
const account = (discordId: string) => rooms().AccountRoom.getByName(discordId)

/** The Games calls as the Worker makes them, every new Game named `gameId`. */
function calls(gameId: string) {
  const deps: CallDeps = {
    db,
    game,
    account: account as never,
    bot: undefined,
    newId: () => gameId,
  }
  return async (who: { discordId: string; accountId: string }, name: string, args: object) => {
    const answer = await gameCall(name, args, who, deps)
    if (answer === null || !answer.ok) throw new Error(JSON.stringify(answer))
    return answer.value
  }
}

describe('account deletion over the rooms', () => {
  it('forgets a Game whose membership never reached the shared database', async () => {
    const leaver = { discordId: 'd-leaver', accountId: 'a-leaver' }
    const stayer = { discordId: 'd-stayer', accountId: 'a-stayer' }
    const call = calls('g-unlisted')
    expect(await call(leaver, 'games.create', { name: 'Tenacity' })).toBe('g-unlisted')
    const code = await call(leaver, 'invites.link', { gameId: 'g-unlisted' })
    await call(stayer, 'invites.redeem', { code })
    expect(await account(leaver.discordId).gameIds()).toEqual(['g-unlisted'])
    // As if the Game's publish had failed: the shared database does not have them in it.
    await SHARED.prepare('delete from memberships where discord_id = ?1')
      .bind(leaver.discordId)
      .run()

    expect(await deleteRoomAccount(leaver, { db, game, account })).toBeNull()

    const members = await game('g-unlisted').act(stayer.discordId, 'members', undefined as never)
    expect(members).toMatchObject({
      ok: true,
      value: [{ userId: stayer.discordId, organizer: true }],
    })
    expect(await account(leaver.discordId).gameIds()).toEqual([])
  })

  it("seeds an older account room's Games from the shared database when its player opens it", async () => {
    const player = 'd-seeded'
    await SHARED.prepare(
      'insert into memberships (game_id, discord_id, mediator, organizer) values (?1, ?2, 0, 0)'
    )
      .bind('g-before', player)
      .run()
    const room = account(player)
    const res = await room.fetch('https://room/', {
      headers: { upgrade: 'websocket', 'x-su-member': player },
    })
    res.webSocket?.accept()
    await vi.waitFor(async () => expect(await room.gameIds()).toEqual(['g-before']), {
      timeout: 2000,
      interval: 20,
    })
    res.webSocket?.close(1000)
  })
})
