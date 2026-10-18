import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { BOT_PATH_PREFIX, BOT_RELAY_POST_ROLL_PATH } from 'game-domain/botWire'
import { api } from '../../../convex/_generated/api'
import { NATIVE_FETCH_GLOBALS, NATIVE_OUTBOUND } from '../../env'
import type { Ctx } from '../fixtures'
import { addPilot, seedTable } from '../fixtures'
import { testConvexWithHttp } from '../harness'

/**
 * A Play roll reaches a bound Discord channel, over the wire, with the bot
 * Worker mocked.
 *
 * The e2e tier cannot run this one: binding is the bot's (`/su bind`, through
 * its `/bot/*` door), which resolves the caller by a linked Discord account,
 * and the test sign-in seam's accounts have none; and the relay URL is
 * deployment env, which a spec cannot set on the backend it runs against. So
 * it runs here, at the Convex layer, as end to end as that layer goes:
 *
 *  - the bot binds the Game's channel through its real HTTP door (`/bot/
 *    bindChannel`, bearer `BOT_SECRET`), as `/su bind` does;
 *  - the player posts the roll Play sends (`channelBindings.postRoll`, the
 *    Core Mechanic's d20, the pilot naming the roller);
 *  - the bot Worker is a real local HTTP server (`Bun.serve`) at
 *    `BOT_URL`, so the request crosses a socket, path, bearer and
 *    body as the Worker reads them, and its answer comes back the same way.
 *
 * `channelBindings.test.ts` covers postRoll's every branch with `fetch`
 * stubbed; `PlaySide.connected.test.tsx` covers Play calling it and the Feed
 * line's Posted / Not posted / Retry.
 */

type Received = { path: string; auth: string | null; body: Record<string, unknown> }

const SECRET = 'relay-secret'
let received: Received[] = []
/** How the mocked Worker answers the next post. */
let answer: () => Response = () => Response.json({ ok: true, messageId: 'msg-1' })
let relay: ReturnType<typeof Bun.serve> | undefined

/**
 * Env the deployment's `auth.ts` and `http.ts` read once loaded (the bot's
 * door sits on the real router, `testConvexWithHttp`), and the relay's.
 */
const ENV_KEYS = ['SITE_URL', 'CONVEX_SITE_URL', 'BOT_URL', 'BOT_SECRET'] as const
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}

// The happy-dom preload swaps in a browser's `fetch`, `URL`, `Headers`,
// `Request` and `Response`; a browser's fetch sends a CORS preflight no
// deployment sends. Convex runs on the runtime's own, so this file does too
// (`discordSignIn.test.ts`).
const NATIVE = { ...NATIVE_FETCH_GLOBALS, ...NATIVE_OUTBOUND }
const happyDom: Partial<typeof NATIVE> = {}

beforeAll(() => {
  for (const key of Object.keys(NATIVE) as (keyof typeof NATIVE)[]) {
    Object.assign(happyDom, { [key]: globalThis[key] })
  }
  Object.assign(globalThis, NATIVE)
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key]
  process.env.SITE_URL = 'https://app.test'
  process.env.CONVEX_SITE_URL = 'https://deployment.convex.site'
  relay = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(request) {
      received.push({
        path: new URL(request.url).pathname,
        auth: request.headers.get('authorization'),
        body: (await request.json()) as Record<string, unknown>,
      })
      return answer()
    },
  })
})

afterAll(() => {
  void relay?.stop(true)
  Object.assign(globalThis, happyDom)
  for (const key of ENV_KEYS) {
    const value = savedEnv[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

beforeEach(() => {
  received = []
  answer = () => Response.json({ ok: true, messageId: 'msg-1' })
  process.env.BOT_URL = `http://127.0.0.1:${relay?.port}/`
  process.env.BOT_SECRET = SECRET
})

/** A Game with a Discord-linked Organiser and a player who has a pilot in it. */
async function seedPilotTable(t: Ctx) {
  const table = await seedTable(t, { discord: true })
  await addPilot(table.player, 'sparks', table.gameId)
  return table
}

/** `/su bind` as the bot sends it: through the `/bot/*` door, with the bot's bearer. */
async function bindThroughBotDoor(t: Ctx, gameId: string) {
  const response = await t.fetch(`${BOT_PATH_PREFIX}bindChannel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      discordId: 'd-org',
      channelId: '4242',
      channelName: 'salvage-run',
      game: gameId,
    }),
  })
  expect(response.status).toBe(200)
  expect(((await response.json()) as { ok: boolean }).ok).toBe(true)
}

describe('a Play roll posts to the bound channel through the bot relay', () => {
  test('bound by the bot, posted over HTTP, Posted on the way back', async () => {
    const t = testConvexWithHttp()
    const { player, gameId } = await seedPilotTable(t)
    await bindThroughBotDoor(t, gameId)
    expect(await player.as.query(api.channelBindings.current, { gameId })).toMatchObject({
      channelId: '4242',
      channelName: 'salvage-run',
    })

    const result = await player.as.action(api.channelBindings.postRoll, {
      gameId,
      pilotId: 'sparks',
      roll: { tableName: 'Core Mechanic', rolls: [14] },
      post: true,
    })

    expect(result).toEqual({ kind: 'posted', channelId: '4242', messageId: 'msg-1' })
    expect(received).toEqual([
      {
        path: BOT_RELAY_POST_ROLL_PATH,
        auth: `Bearer ${SECRET}`,
        body: {
          channelId: '4242',
          tableName: 'Core Mechanic',
          rolls: [14],
          roller: 'sparks',
          ownerDiscordId: 'd-player',
        },
      },
    ])
  })

  test('the Worker refusing the credentials comes back as Not posted, with why', async () => {
    const t = testConvexWithHttp()
    const { player, gameId } = await seedPilotTable(t)
    await bindThroughBotDoor(t, gameId)
    answer = () => Response.json({ error: 'unauthorized' }, { status: 401 })

    expect(
      await player.as.action(api.channelBindings.postRoll, {
        gameId,
        roll: { tableName: 'Core Mechanic', rolls: [3] },
        post: true,
      })
    ).toEqual({
      kind: 'failed',
      channelId: '4242',
      message: 'The Discord bot refused this deployment’s credentials.',
    })
    expect(received).toHaveLength(1)
  })

  test('a Worker that is down is Not posted, never silent', async () => {
    const t = testConvexWithHttp()
    const { player, gameId } = await seedPilotTable(t)
    await bindThroughBotDoor(t, gameId)
    // Nothing listens on a port the OS just handed back.
    const closed = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response() })
    process.env.BOT_URL = `http://127.0.0.1:${closed.port}`
    await closed.stop(true)

    expect(
      await player.as.action(api.channelBindings.postRoll, {
        gameId,
        roll: { tableName: 'Core Mechanic', rolls: [20] },
        post: true,
      })
    ).toEqual({
      kind: 'failed',
      channelId: '4242',
      message: 'The Discord bot could not be reached.',
    })
    expect(received).toHaveLength(0)
  })
})
