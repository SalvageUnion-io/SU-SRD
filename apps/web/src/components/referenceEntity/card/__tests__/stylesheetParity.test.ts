import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readPackageStylesheet } from '../../../../styles/__tests__/packageStylesheet'
import { grainClass, grainSvg } from '../cardGrain'

/**
 * Card chrome that a stylesheet class carries but TypeScript defines, held
 * equal (a stylesheet cannot import a constant or call a function):
 *
 * - the grain image: `grainSvg` builds it from the `speckle` tokens, and
 *   `styles/grain/<grain>.svg` holds it for the `.su-grain--*` classes.
 */
const STYLES = join(import.meta.dir, '../../../../styles')
const css = readPackageStylesheet()

describe('card grain', () => {
  for (const grain of ['ink', 'paper'] as const) {
    test(`styles/grain/${grain}.svg is the tokens' ${grain} grain`, () => {
      const file = readFileSync(join(STYLES, 'grain', `${grain}.svg`), 'utf8')
      expect(file.trim()).toBe(grainSvg(grain))
    })

    test(`.${grainClass(grain)} wears styles/grain/${grain}.svg`, () => {
      const rule = new RegExp(
        `\\.${grainClass(grain)}\\s*\\{\\s*background-image:\\s*url\\('\\.\\./grain/${grain}\\.svg'\\);\\s*\\}`
      )
      expect(css).toMatch(rule)
    })
  }

  test('no grain, no class', () => {
    expect(grainClass(undefined)).toBeUndefined()
  })
})
