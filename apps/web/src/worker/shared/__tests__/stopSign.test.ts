import { describe, expect, spyOn, test } from 'bun:test'
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
  const calls: { url: string; init?: RequestInit }[] = []
  const BOT = {
    fetch: async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return answer()
    },
  }
  return { calls, BOT }
}

const ok = () => Promise.resolve(Response.json({ ok: true, messageId: 'm1' }))

describe('posting the Stop Sign', () => {
  test('asks the bot to post in the Game’s bound channel, over its binding', async () => {
    const { calls, BOT } = relay(ok)
    await postStopSign({ SHARED: bound(), BOT }, 'g-1')
    expect(calls).toHaveLength(1)
    expect(new URL(calls[0]?.url ?? '').pathname).toBe(BOT_RELAY_POST_STOP_PATH)
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ channelId: 'c-1' })
  })

  test('posts nothing for an unbound Game or a Worker without the binding', async () => {
    const { calls, BOT } = relay(ok)
    await postStopSign({ SHARED: bound(), BOT }, 'g-2')
    const errors = spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      await postStopSign({ SHARED: bound() }, 'g-1')
    } finally {
      errors.mockRestore()
    }
    expect(calls).toEqual([])
  })

  test('a refusal or an unreachable bot is only logged', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const refused = relay(() =>
        Promise.resolve(Response.json({ ok: false, status: 403, message: 'no' }, { status: 502 }))
      )
      await postStopSign({ SHARED: bound(), BOT: refused.BOT }, 'g-1')
      const down = relay(() => Promise.reject(new Error('offline')))
      await postStopSign({ SHARED: bound(), BOT: down.BOT }, 'g-1')
      const garbled = relay(() => Promise.resolve(new Response('not json')))
      await postStopSign({ SHARED: bound(), BOT: garbled.BOT }, 'g-1')
      expect(refused.calls.length + down.calls.length + garbled.calls.length).toBe(3)
      expect(warn).toHaveBeenCalledTimes(3)
    } finally {
      warn.mockRestore()
    }
  })
})
