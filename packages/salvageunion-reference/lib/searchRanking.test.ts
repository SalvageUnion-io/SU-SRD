import { describe, expect, test } from 'bun:test'
import {
  matchSearchTokens,
  scoreSearchMatch,
  searchNameWords,
  tokenizeSearchQuery,
} from './searchRanking.js'

describe('tokenizeSearchQuery', () => {
  test('lowers, trims and splits on whitespace', () => {
    expect(tokenizeSearchQuery('  Heavy   LASER ')).toEqual({
      loweredQuery: 'heavy   laser',
      tokens: ['heavy', 'laser'],
    })
  })

  test('a blank query is null — it matches nothing', () => {
    expect(tokenizeSearchQuery('   ')).toBeNull()
  })
})

describe('searchNameWords', () => {
  test('splits on anything that is not a letter or digit', () => {
    expect(searchNameWords('.50 cal machine-gun')).toEqual(['50', 'cal', 'machine', 'gun'])
  })
})

describe('matchSearchTokens', () => {
  const literal = (text: string) => (token: string) => text.includes(token)

  test('every token must land (AND)', () => {
    expect(matchSearchTokens(['heavy', 'laser'], [], literal('heavy arc laser'))).toEqual({
      matches: true,
      usedTypo: false,
    })
    expect(matchSearchTokens(['heavy', 'plasma'], [], literal('heavy arc laser')).matches).toBe(
      false
    )
  })

  test('a 4+ character token may be one edit from a NAME word', () => {
    expect(matchSearchTokens(['hellfyre'], ['hellfire'], literal(''))).toEqual({
      matches: true,
      usedTypo: true,
    })
  })

  test('short tokens get no typo forgiveness', () => {
    expect(matchSearchTokens(['cak'], ['cal'], literal('')).matches).toBe(false)
  })

  test('two edits away is not a match', () => {
    expect(matchSearchTokens(['hellfyer'], ['hellfire'], literal('')).matches).toBe(false)
  })

  test('insertions and deletions count as one edit', () => {
    expect(matchSearchTokens(['helfire'], ['hellfire'], literal('')).matches).toBe(true)
    expect(matchSearchTokens(['hellffire'], ['hellfire'], literal('')).matches).toBe(true)
  })
})

describe('scoreSearchMatch', () => {
  const score = (nameText: string, query: string, extra: object = {}) => {
    const q = tokenizeSearchQuery(query)
    if (!q) throw new Error('blank query in test')
    return scoreSearchMatch({ ...q, nameText, usedTypo: false, ...extra })
  }

  test('name tiers: exact > prefix > contains > every token', () => {
    expect(score('laser', 'laser')).toBe(100)
    expect(score('laser rifle', 'laser')).toBe(50)
    expect(score('heavy laser', 'laser')).toBe(25)
    expect(score('heavy arc laser', 'heavy laser')).toBe(20)
    expect(score('rifle', 'laser')).toBe(0)
  })

  test('a typo-assisted match loses 15', () => {
    expect(score('hellfire', 'hellfyre', { usedTypo: true })).toBe(-15)
  })

  test('ORM-only refinements apply only when supplied', () => {
    expect(score('rifle', 'laser', { descriptionText: 'fires a laser' })).toBe(10)
    expect(score('rifle', 'laser', { matchedFieldCount: 2 })).toBe(10)
  })
})
