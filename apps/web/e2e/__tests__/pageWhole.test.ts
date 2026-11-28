/**
 * The page-whole scan's folds (`_pageWhole.ts`, R43) on hand-written markup:
 * a class page's Ability may unfold its own rules under its Compact, and
 * nothing else folds, there or anywhere. happy-dom lays nothing out, so
 * `documentPage` gives every element a 100 by 20 box.
 */
import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { ONE_FOLD, PATTERN_FOLD, scanPageWhole } from '../_pageWhole'
import { documentPage } from './_page'

const { restore } = documentPage()
afterAll(restore)

const CLASS = '/classes/hacker/'

/** A track's tier: the Ability's Compact, then what follows it. */
const tier = (
  after: string,
  compact = '<a class="su-entity-compact" href="/abilities/hacking-kit/">Hacking Kit</a>'
) =>
  `<main><ol class="su-ability-track" data-track="core"><li class="su-ability-track__tier">${compact}${after}</li></ol></main>`

const RULES = '<details class="su-ability-open"><summary>Rules</summary><div>card</div></details>'

const folds = (path: string) =>
  scanPageWhole({ path, one: ONE_FOLD, pattern: PATTERN_FOLD }).filter((f) => f.startsWith('fold:'))

describe('R43: one fold, an Ability unfolding its rules on a class page', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  test('an Ability unfolds its own rules under its Compact on a class page', () => {
    document.body.innerHTML = tier(RULES)
    expect(folds(CLASS)).toEqual([])
  })

  test('the same fold on any other page folds its content', () => {
    document.body.innerHTML = tier(RULES)
    expect(folds('/abilities/')).toHaveLength(1)
    expect(folds('/classes/')).toHaveLength(1)
  })

  test('a fold not after an Ability, or not the rules fold, still fails on a class page', () => {
    document.body.innerHTML = tier(RULES, '<a class="su-entity-compact" href="/systems/x/">X</a>')
    expect(folds(CLASS)).toHaveLength(1)
    document.body.innerHTML = tier('<details><summary>More</summary></details>')
    expect(folds(CLASS)).toHaveLength(1)
    document.body.innerHTML = `<main><section>${RULES}</section></main>`
    expect(folds(CLASS)).toHaveLength(1)
  })

  test('a fold inside the opened rules still fails', () => {
    document.body.innerHTML = tier(
      '<details class="su-ability-open"><summary>Rules</summary><div><details><summary>Inner</summary></details></div></details>'
    )
    expect(folds(CLASS)).toHaveLength(1)
  })

  test('a shut fold drawn only by its summary is still read', () => {
    document.body.innerHTML =
      '<main><details data-box="0,0,0,0"><summary>Hidden?</summary></details></main>'
    expect(folds(CLASS)).toHaveLength(1)
  })
})

describe('R43: a chassis pattern row unfolds its loadout (r6 E5)', () => {
  const ROW =
    '<main><table class="su-ledger__table"><tr><th><span class="su-ledger__under"><details class="su-pattern-fold"><summary>Loadout</summary><span>Red Laser</span></details></span></th></tr></table></main>'

  test("on a chassis page a row's loadout fold is allowed", () => {
    document.body.innerHTML = ROW
    expect(folds('/chassis/mule/')).toEqual([])
  })

  test('the same fold anywhere else, or another fold on a chassis page, fails', () => {
    document.body.innerHTML = ROW
    expect(folds('/systems/')).toHaveLength(1)
    expect(folds(CLASS)).toHaveLength(1)
    document.body.innerHTML =
      '<main><details class="su-pattern-fold"><summary>More</summary></details></main>'
    expect(folds('/chassis/mule/')).toHaveLength(1)
  })
})
