import { describe, expect, test } from 'bun:test'
import { BOT_RELAY_POST_STOP_PATH } from 'game-domain/botWire'
import { postStopSign } from '../stopSign'
import { testDb } from './d1'

function bound() {
  const db = testDb()
  db.sqlite
    .query(
      `insert into channel_bindings (channel_id, game_id, bound_by, channel_name, bound_at)
       values ('c-1', 'g-1', 'd-med', 'table', 0)`
    )
    .run()
  return db
}

/** A bot relay that answers `answer`, recording each request. */
function relay(answer: () => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return answer()
  }) as unknown as typeof fetch
  return { calls, fetchImpl }
}

const ok = () => Promise.resolve(Response.json({ ok: true, messageId: 'm1' }))

describe('posting the Stop Sign', () => {
  test('asks the bot to post in the Game’s bound channel, with the relay secret', async () => {
    const { calls, fetchImpl } = relay(ok)
    const env = { SHARED: bound(), BOT_URL: 'https://bot.example/', BOT_SECRET: 's3' }
    await postStopSign(env, 'g-1', fetchImpl)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(`https://bot.example${BOT_RELAY_POST_STOP_PATH}`)
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: 'Bearer s3' })
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ channelId: 'c-1' })
  })

  test('posts nothing for an unbound Game or an unconfigured Worker', async () => {
    const { calls, fetchImpl } = relay(ok)
    await postStopSign(
      { SHARED: bound(), BOT_URL: 'https://bot', BOT_SECRET: 's' },
      'g-2',
      fetchImpl
    )
    await postStopSign({ SHARED: bound() }, 'g-1', fetchImpl)
    expect(calls).toEqual([])
  })

  test('a refusal or an unreachable bot is only logged', async () => {
    const env = { SHARED: bound(), BOT_URL: 'https://bot', BOT_SECRET: 's' }
    const refused = relay(() =>
      Promise.resolve(Response.json({ ok: false, status: 403, message: 'no' }, { status: 502 }))
    )
    await postStopSign(env, 'g-1', refused.fetchImpl)
    const down = relay(() => Promise.reject(new Error('offline')))
    await postStopSign(env, 'g-1', down.fetchImpl)
    const garbled = relay(() => Promise.resolve(new Response('not json')))
    await postStopSign(env, 'g-1', garbled.fetchImpl)
    expect(refused.calls.length + down.calls.length + garbled.calls.length).toBe(3)
  })
})
