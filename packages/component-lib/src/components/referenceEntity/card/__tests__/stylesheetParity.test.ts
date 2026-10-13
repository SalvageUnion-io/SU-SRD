import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PENNANT_SHAPE } from '../cardChrome'
import { grainClass, grainSvg } from '../cardGrain'

/**
 * Card chrome that a stylesheet class carries but TypeScript defines, held
 * equal (a stylesheet cannot import a constant or call a function):
 *
 * - the grain image: `grainSvg` builds it from the `speckle` tokens, and
 *   `styles/grain/<grain>.svg` holds it for the `.su-grain--*` classes;
 * - the pennant's cut: `PENNANT_SHAPE`, which `.su-pennant` restates.
 */
const STYLES = join(import.meta.dir, '../../../../styles')
const css = readFileSync(join(STYLES, 'index.css'), 'utf8')

describe('card grain', () => {
  for (const grain of ['ink', 'paper'] as const) {
    test(`styles/grain/${grain}.svg is the tokens' ${grain} grain`, () => {
      const file = readFileSync(join(STYLES, 'grain', `${grain}.svg`), 'utf8')
      expect(file.trim()).toBe(grainSvg(grain))
    })

    test(`.${grainClass(grain)} wears styles/grain/${grain}.svg`, () => {
      const rule = new RegExp(
        `\\.${grainClass(grain)}\\s*\\{\\s*background-image:\\s*url\\('\\./grain/${grain}\\.svg'\\);\\s*\\}`
      )
      expect(css).toMatch(rule)
    })
  }

  test('no grain, no class', () => {
    expect(grainClass(undefined)).toBeUndefined()
  })
})

describe('cost pennant', () => {
  test('.su-pennant cuts PENNANT_SHAPE', () => {
    const rule = css.match(/\.su-pennant\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toContain(`clip-path: ${PENNANT_SHAPE};`)
  })
})
