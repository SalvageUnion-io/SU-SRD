/** The export's write path: no key lands outside the output directory. */
import { describe, expect, test } from 'bun:test'
import { join, resolve } from 'node:path'
import { destinationFor } from '../export-lp-assets'

describe('destinationFor', () => {
  const out = resolve('/tmp/export')

  test('places a key under the output directory', () => {
    expect(destinationFor(out, 'chassis/mule.webp')).toBe(join(out, 'chassis/mule.webp'))
  })

  test('refuses a key that climbs out of the output directory (CodeQL #93)', () => {
    expect(() => destinationFor(out, '../../etc/passwd')).toThrow(/escapes/)
    expect(() => destinationFor(out, 'chassis/../../x')).toThrow(/escapes/)
    expect(() => destinationFor(out, '/etc/passwd')).toThrow(/escapes/)
  })
})
