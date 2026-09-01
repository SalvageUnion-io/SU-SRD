/**
 * The bot's embed colours are a hand-maintained mirror of `--color-roll-*` and
 * `--color-rust` in `packages/component-lib/src/styles/theme.css`. Both
 * `format.ts` and this repo's CLAUDE.md say to keep them in lockstep, and until
 * now nothing checked it — `format.test.ts` only asserts `getColor` against
 * `ROLL_COLORS` itself, so both sides could move together and stay "green".
 *
 * That is exactly how `0xb7410e` survived as the bot's most-used colour while
 * canon rust was `#a85222`. This test reads the stylesheet and compares.
 */

import { describe, expect, test } from 'bun:test'
import { NEUTRAL_EMBED_COLOR, ROLL_COLORS } from '../format.js'

const THEME_CSS = new URL(
  '../../../../packages/component-lib/src/styles/theme.css',
  import.meta.url
).pathname

/** `--color-x: rgb(1, 2, 3)` → 0x010203. Throws if the token is absent. */
function tokenToInt(css: string, token: string): number {
  const match = css.match(new RegExp(`--${token}:\\s*rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)`))
  if (!match) throw new Error(`theme.css has no --${token} in rgb() form`)
  const [, r, g, b] = match
  return (Number(r) << 16) | (Number(g) << 8) | Number(b)
}

const css = await Bun.file(THEME_CSS).text()

describe('theme.css lockstep', () => {
  test.each([
    ['color-roll-nailed', ROLL_COLORS.nailed],
    ['color-roll-success', ROLL_COLORS.success],
    ['color-roll-tough', ROLL_COLORS.tough],
    ['color-roll-failure', ROLL_COLORS.failure],
    ['color-roll-cascade', ROLL_COLORS.cascade],
  ])('%s matches the bot constant', (token, botValue) => {
    expect(tokenToInt(css, token)).toBe(botValue)
  })

  test('the neutral embed tone is canon --color-rust', () => {
    expect(tokenToInt(css, 'color-rust')).toBe(NEUTRAL_EMBED_COLOR)
  })
})
