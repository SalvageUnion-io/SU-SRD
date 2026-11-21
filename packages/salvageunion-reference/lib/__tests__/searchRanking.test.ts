import { describe, expect, test } from 'bun:test'
import {
  matchSearchTokens,
  scoreSearchMatch,
  searchNameWords,
  searchSquashedName,
  searchWordStem,
  tokenizeSearchQuery,
} from '../searchRanking'

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

  test('the looser readings of a name: an alias, no punctuation, another word form', () => {
    expect(score('structure points', 'sp')).toBe(90)
    expect(score('bio-titan', 'biotitan')).toBe(85)
    expect(score('overheat', 'overheating')).toBe(20)
    // Under every exact name, over every prefix.
    expect(score('sp', 'sp')).toBe(100)
  })

  test("a question's filler is left out, and the name tiers still read the query as typed", () => {
    expect(score('salvaging', 'how does salvaging work?')).toBe(100)
    expect(score("let's make a deal", "let's make a deal")).toBe(100)
  })

  test("the rules' own kinds come ahead on equal terms", () => {
    expect(score('rifle', 'turn', { schemaName: 'guides' })).toBe(4)
    expect(score('rifle', 'turn', { schemaName: 'keywords' })).toBe(3)
    expect(score('rifle', 'turn', { schemaName: 'systems' })).toBe(0)
  })
})

describe('question filler and word forms', () => {
  test('filler words are dropped while a naming word is left', () => {
    expect(tokenizeSearchQuery('How does salvaging work?')).toEqual({
      loweredQuery: 'salvaging',
      tokens: ['salvaging'],
      rawQuery: 'how does salvaging work?',
    })
    // Nothing but filler: the query is matched as typed.
    expect(tokenizeSearchQuery('the works')?.tokens).toEqual(['the', 'works'])
  })

  test('a word is cut back to a stem another form holds', () => {
    expect(searchWordStem('salvaging')).toBe('salvag')
    expect(searchWordStem('overheating')).toBe('overheat')
    expect(searchWordStem('abilities')).toBe('abilit')
    expect(searchWordStem('damaged')).toBe('damag')
    expect(searchWordStem('mechs')).toBe('mech')
    expect(searchWordStem('chassis')).toBe('chassi')
    // Too short to cut, or nothing to cut.
    expect(searchWordStem('ring')).toBe('ring')
    expect(searchWordStem('boss')).toBe('boss')
    expect(searchWordStem('heat')).toBe('heat')
  })

  test('a token matches through its stem', () => {
    const literal = (text: string) => (token: string) => text.includes(token)
    expect(matchSearchTokens(['overheating'], [], literal('your reactor may overheat'))).toEqual({
      matches: true,
      usedTypo: false,
    })
  })

  test('a name without its punctuation', () => {
    expect(searchSquashedName('bio-titan')).toBe('biotitan')
  })
})
