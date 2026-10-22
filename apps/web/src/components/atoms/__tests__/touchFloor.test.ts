import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readPackageStylesheet } from '../../../styles/__tests__/packageStylesheet'

/**
 * The coarse-pointer touch floor (ruleset §4.6: every target is at least 44px
 * under a coarse pointer).
 *
 * The floor lives once, in theme.css, unlayered, so it also outranks the apps'
 * own stylesheets. The package stylesheet carries only the hit-area half. This
 * pins `.su-btn` (the anchors `buttonVariants` dresses included) onto the
 * floor, and pins the mini button and the interactive chip OFF it and onto the
 * hit-area pseudo-element instead, so they keep the size they are drawn at.
 */

const STYLES = join(import.meta.dir, '../../../styles')

/**
 * The first `@media (pointer: coarse)` block in `text`, or with `holding`, the
 * first that holds it (the package's hit-area half, `pointer-motion.css`, after
 * the entity forms' own coarse rules).
 */
function coarseBlock(file: string, text: string, holding?: string): string {
  const css = text.replace(/\/\*[\s\S]*?\*\//g, '')
  let start = css.indexOf('@media (pointer: coarse)')
  expect(start).toBeGreaterThan(-1)
  while (start > -1) {
    // The block runs to the brace that closes the @media rule.
    let depth = 0
    let block: string | undefined
    for (let i = css.indexOf('{', start); i < css.length; i++) {
      if (css[i] === '{') depth++
      if (css[i] === '}' && --depth === 0) {
        block = css.slice(start, i + 1)
        break
      }
    }
    if (block === undefined) break
    if (holding === undefined || block.includes(holding)) return block
    start = css.indexOf('@media (pointer: coarse)', start + block.length)
  }
  throw new Error(
    `no closed @media (pointer: coarse) block${holding ? ` holding ${holding}` : ''} in ${file}`
  )
}

/** The 44px floor, as the Full Size (`--size-full`) spells it. */
const FLOOR = 'var\\(--size-full\\)'

/** The selector list of the rule that sets the 44px floor. */
function floorSelectors(block: string): string[] {
  const rule = block.match(new RegExp(`([^{}]+)\\{[^{}]*min-height:\\s*${FLOOR}`))
  expect(rule).not.toBeNull()
  return (rule?.[1] ?? '')
    .split(/,(?![^(]*\))/)
    .map((s) => s.trim())
    .filter(Boolean)
}

describe('the coarse-pointer touch floor', () => {
  const theme = coarseBlock('theme.css', readFileSync(join(STYLES, 'theme.css'), 'utf8'))
  const index = coarseBlock('index.css', readPackageStylesheet(), '.su-hit-area::after')

  test('the floor is set once, in theme.css', () => {
    expect(index).not.toMatch(new RegExp(`min-height:\\s*(?:44px|${FLOOR})`))
  })

  test('every .su-btn size is on the floor, the mini rung and hit-area buttons excepted', () => {
    expect(floorSelectors(theme)).toContain('.su-btn:not(.su-btn--mini, .su-hit-area)')
  })

  test("a menu's items are on the floor (§4.6, hard rule R12)", () => {
    expect(floorSelectors(theme)).toContain("[role='menuitem']:not(.su-btn--mini, .su-hit-area)")
  })

  test('the Union bar switcher tabs and the brand link are on the floor', () => {
    // They are anchors but not .su-btn, and the switcher's overflow:hidden
    // would clip a hit-area pseudo-element, so they take the real 44px.
    expect(floorSelectors(theme)).toContain('.su-union-bar__tab')
    expect(floorSelectors(theme)).toContain('.su-union-bar__brand')
  })

  test('mini buttons and interactive chips reach 44px through a hit area instead', () => {
    for (const selector of floorSelectors(theme).filter((s) => /^(button|\[role)/.test(s))) {
      expect(selector).toMatch(/:not\(\.su-btn--mini, \.su-hit-area[,)]/)
    }
    expect(index).toMatch(
      new RegExp(`\\.su-btn--mini::after,\\s*\\.su-hit-area::after,[^{]*\\{[^}]*${FLOOR}`)
    )
  })

  test('breadcrumb links reach 44px through the hit area', () => {
    // The phone's trail row is plain 17px text links; the pseudo-element
    // gives each crumb the floor without stretching the row.
    expect(index).toMatch(new RegExp(`\\.su-crumbs__link::after\\s*\\{[^}]*${FLOOR}`))
  })
})
