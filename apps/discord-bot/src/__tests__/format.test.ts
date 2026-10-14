/**
 * Pure shaping helpers — no Discord objects needed.
 */
import { describe, expect, test } from 'bun:test'
import { ROLL_ATTRIBUTION } from '../format'

describe('roll attribution', () => {
  test('credits Randsum.dev, since rolls are powered by @randsum/roller', () => {
    expect(ROLL_ATTRIBUTION).toBe('Powered by Randsum.dev')
  })
})
