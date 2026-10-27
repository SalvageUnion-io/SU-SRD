import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { exports } from 'cloudflare:workers'
import { NATIVE_FETCH_GLOBALS } from '../../../test/env'
import { serveGameCall } from '../gameCalls'
import { testDb } from '../shared/__tests__/d1'

/**
 * `POST /__rooms/call` as the Worker serves it: one call by name, as the
 * session's player, answered as JSON; the calls themselves are
 * `shared/__tests__/gameCalls.test.ts`'s.
 */

const { Request } = NATIVE_FETCH_GLOBALS
const namespaces = exports as Record<string, unknown>

afterEach(() => {
  delete namespaces.GameRoom
})

const env = () => ({ SHARED: testDb() as never })
const ORG = { discordId: 'd-org', accountId: 'a-org' }

const post = (body: unknown, who: typeof ORG | null = null, origin = 'https://salvageunion.io') =>
  serveGameCall(
    new Request('https://salvageunion.io/__rooms/call', {
      method: 'POST',
      headers: { origin },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env(),
    async () => who as never
  )

describe('POST /__rooms/call', () => {
  test('answers a call by name, as JSON nobody caches', async () => {
    const res = await post({ name: 'templates.list', args: {} })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toMatchObject({ ok: true, value: [{ id: 'starter-set' }] })
  })

  test('a refusal is an answer, worded for the player', async () => {
    expect(await (await post({ name: 'games.listMine' })).json()).toEqual({
      ok: false,
      refusal: 'Sign in first',
    })
  })

  test('only a POST with a name; an unknown call is a 404', async () => {
    const get = await serveGameCall(
      new Request('https://salvageunion.io/__rooms/call'),
      env(),
      async () => null
    )
    expect(get.status).toBe(405)
    expect((await post('not json')).status).toBe(400)
    expect((await post({ args: {} })).status).toBe(400)
    expect((await post({ name: 'games.nope' }, ORG)).status).toBe(404)
  })

  test('refuses a call sent from another site, however signed in', async () => {
    const res = await post({ name: 'games.listMine' }, ORG, 'https://elsewhere.example')
    expect(res.status).toBe(403)
  })

  test('a defect is a 500 without its message', async () => {
    namespaces.GameRoom = {
      getByName: () => ({
        act: async () => {
          throw new Error('the room fell over')
        },
      }),
    }
    const logged = spyOn(console, 'error').mockImplementation(() => {})
    const res = await post({ name: 'games.get', args: { gameId: 'g1' } }, ORG)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'call_failed' })
    expect(logged).toHaveBeenCalled()
    logged.mockRestore()
  })
})
