/**
 * Every Discord accent is a mirror of a `theme.css` token, as an integer. This
 * reads the stylesheet and compares, so the mirror cannot drift while both of
 * its sides stay green.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DISCORD_NEUTRAL_ACCENT,
  DISCORD_ROLL_ACCENT,
  DISCORD_TONE_ACCENT,
  discordAccent,
} from '../discordAccents'

const css = readFileSync(
  join(import.meta.dir, '../../../../../apps/web/src/styles/theme.css'),
  'utf8'
)

/** `--color-x: rgb(1, 2, 3)` → 0x010203. Throws if the token is absent. */
function token(name: string): number {
  const match = css.match(new RegExp(`--color-${name}:\\s*rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)`))
  if (!match) throw new Error(`--color-${name} not in theme.css`)
  const [, r, g, b] = match.map(Number)
  return ((r ?? 0) << 16) | ((g ?? 0) << 8) | (b ?? 0)
}

describe('theme.css lockstep', () => {
  test('each tone mirrors its token, except ink (the rules blue) and crawler (its band)', () => {
    for (const [tone, accent] of Object.entries(DISCORD_TONE_ACCENT)) {
      const source =
        tone === 'ink' || tone === 'ink-2' ? 'wk-line' : tone === 'crawler' ? 'crawler-band' : tone
      expect([tone, accent]).toEqual([tone, token(source)])
    }
  })

  test('each roll outcome mirrors --color-roll-*', () => {
    for (const [band, accent] of Object.entries(DISCORD_ROLL_ACCENT)) {
      expect([band, Number(accent)]).toEqual([band, token(`roll-${band}`)])
    }
  })

  test('the neutral accent is canon --color-rust', () => {
    expect(DISCORD_NEUTRAL_ACCENT).toBe(token('rust'))
  })

  test('an unknown tone takes the rules blue', () => {
    expect(discordAccent('no-such-tone')).toBe(token('wk-line'))
  })
})
