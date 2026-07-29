import { describe, expect, test } from 'bun:test'

import { createItunClient, interpret } from '../itun/client.js'

/**
 * The bot's ITUN client.
 *
 * Two things are worth pinning here and neither needs a network: that an
 * unconfigured bot produces **no client at all** (Solo mode), and that every
 * wire response maps onto exactly one of the three result kinds — because the
 * commands branch exhaustively on those, and an unmapped response would show a
 * player a permissions error for what was actually an outage.
 */

describe('createItunClient', () => {
  test('is null unless BOTH the url and the secret are present', () => {
    // Solo mode is the default, and it is a null client rather than a throwing
    // stub so every call site has to acknowledge it at compile time.
    expect(createItunClient({})).toBeNull()
    expect(createItunClient({ siteUrl: 'https://x.convex.site' })).toBeNull()
    expect(createItunClient({ botSecret: 'shh' })).toBeNull()
    expect(createItunClient({ siteUrl: '', botSecret: 'shh' })).toBeNull()
  })

  test('is a client when both are present', () => {
    expect(createItunClient({ siteUrl: 'https://x.convex.site', botSecret: 'shh' })).not.toBeNull()
  })
})

describe('interpret', () => {
  test('an ok payload becomes a value', () => {
    expect(interpret(200, { ok: true, games: [] })).toEqual({
      kind: 'ok',
      value: { ok: true, games: [] },
    })
  })

  test('a denial keeps its reason so the command can word it properly', () => {
    expect(interpret(200, { ok: false, reason: 'unlinked', message: 'nope' })).toEqual({
      kind: 'denied',
      reason: 'unlinked',
      message: 'nope',
    })
  })

  test('a bad credential is an outage, not a permissions problem', () => {
    // 401 means the BOT is misconfigured. Telling a player they lack
    // permission would send them chasing an Organizer over a deploy fault.
    expect(interpret(401, null).kind).toBe('unavailable')
    // 404 is the deployment having the route switched off — same class of
    // fault, same answer.
    expect(interpret(404, null).kind).toBe('unavailable')
  })

  test('any other non-200 is unavailable', () => {
    expect(interpret(500, null).kind).toBe('unavailable')
    expect(interpret(502, 'gateway error').kind).toBe('unavailable')
  })

  test('an unrecognised 200 body is unavailable rather than silently ok', () => {
    // Failing closed matters: treating an unknown shape as success would render
    // an embed full of "—" and look like real, empty data.
    expect(interpret(200, null).kind).toBe('unavailable')
    expect(interpret(200, { ok: false }).kind).toBe('unavailable')
    expect(interpret(200, { ok: false, reason: 'invented-reason' }).kind).toBe('unavailable')
  })
})
