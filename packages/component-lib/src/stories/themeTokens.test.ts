import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { familiesOf, parseThemeTokens, resolveToken, tokensIn } from './_themeTokens'

const themeCss = readFileSync(join(import.meta.dir, '../styles/theme.css'), 'utf8')
const tokens = parseThemeTokens(themeCss)

describe('parseThemeTokens', () => {
  test('reads both the @theme and the :root block, and nothing from comments', () => {
    const css = `/* --color-ghost: red; */
@theme { --color-ink: rgb(1, 2, 3); /* note */ --text-badge: 11px; }
:root { --bw-chrome: 1.5px; }
.sheet--pilot { --tone: red; }`
    expect(parseThemeTokens(css)).toEqual([
      { name: '--color-ink', value: 'rgb(1, 2, 3)' },
      { name: '--text-badge', value: '11px' },
      { name: '--bw-chrome', value: '1.5px' },
    ])
  })

  test('finds every namespace the Foundations pages specimen in the real theme.css', () => {
    for (const prefix of ['--color-', '--text-', '--font-', '--tracking-', '--bw-', '--radius-'])
      expect(tokensIn(tokens, prefix).length).toBeGreaterThan(0)
    expect(tokens.map((t) => t.name)).toContain('--space-12')
  })
})

describe('resolveToken', () => {
  test('substitutes an alias chain down to its literal', () => {
    const ok = tokens.find((t) => t.name === '--color-status-ok')
    expect(ok && resolveToken(ok.value, tokens)).toBe(
      tokens.find((t) => t.name === '--color-roll-success')?.value
    )
  })
})

describe('familiesOf', () => {
  test('groups by the first segment after the prefix, in first-seen order', () => {
    const families = familiesOf(
      parseThemeTokens(
        '@theme { --color-ink: a; --color-paper: b; --color-ink-2: c; --color-tl-1: d; }'
      ),
      '--color-'
    )
    expect(families.map(([family, members]) => [family, members.length])).toEqual([
      ['ink', 2],
      ['paper', 1],
      ['tl', 1],
    ])
  })
})
