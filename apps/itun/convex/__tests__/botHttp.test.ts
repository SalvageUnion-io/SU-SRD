import { describe, expect, test } from 'bun:test'

import { BOT_OPS, bearerToken, opFromPath, secretsMatch } from '../botHttp'

/**
 * The bot's HTTP door.
 *
 * `botRoute` itself is an `httpAction`, and the convex-test harness cannot
 * mount it — `http.ts` is deliberately outside the module map because it drags
 * in the Discord auth provider (see `harness.ts`). So the *authorization* it
 * enforces is proven in `bot.test.ts`, against the internal functions where it
 * actually lives, and the parts this file covers are the ones the route adds on
 * top: who gets in, and which op a path names.
 *
 * That split is the point. If the credential check were the only thing standing
 * between a caller and somebody's sheet, testing it in isolation would be thin
 * comfort. It isn't: every forwarded call re-resolves the actor from scratch.
 */

describe('secretsMatch', () => {
  test('accepts only an exact match', () => {
    expect(secretsMatch('correct-horse', 'correct-horse')).toBe(true)
    expect(secretsMatch('correct-horse', 'correct-horsf')).toBe(false)
    expect(secretsMatch('', '')).toBe(true)
  })

  test('rejects a prefix, a suffix, and a length mismatch', () => {
    // The comparison is constant-time over equal-length inputs, so a near-miss
    // must not be distinguishable from a wild miss by result.
    expect(secretsMatch('correct', 'correct-horse')).toBe(false)
    expect(secretsMatch('correct-horse-battery', 'correct-horse')).toBe(false)
    expect(secretsMatch('xorrect-horse', 'correct-horse')).toBe(false)
  })
})

describe('bearerToken', () => {
  test('extracts a bearer token', () => {
    expect(bearerToken('Bearer abc123')).toBe('abc123')
    expect(bearerToken('  Bearer abc123  ')).toBe('abc123')
  })

  test('rejects anything that is not a bearer header', () => {
    expect(bearerToken(null)).toBeNull()
    expect(bearerToken('')).toBeNull()
    expect(bearerToken('abc123')).toBeNull()
    expect(bearerToken('Basic abc123')).toBeNull()
    // Case matters — Discord and Convex both emit the canonical casing, and
    // accepting variants only widens what has to be reasoned about.
    expect(bearerToken('bearer abc123')).toBeNull()
  })
})

describe('opFromPath', () => {
  test('names a known op', () => {
    expect(opFromPath('/bot/crew')).toBe('crew')
    expect(opFromPath('/bot/recordRoll')).toBe('recordRoll')
  })

  test('refuses anything else', () => {
    expect(opFromPath('/bot/')).toBeNull()
    expect(opFromPath('/bot/nope')).toBeNull()
    expect(opFromPath('/crew')).toBeNull()
    // No traversal into another op, and no nesting.
    expect(opFromPath('/bot/crew/extra')).toBeNull()
    expect(opFromPath('/bot/../auth')).toBeNull()
  })

  test('every advertised op resolves', () => {
    // Guards the mapping against an op being added to one list and not the
    // other, which would 404 at runtime rather than at build.
    for (const op of BOT_OPS) {
      expect(opFromPath(`/bot/${op}`)).toBe(op)
    }
  })
})
