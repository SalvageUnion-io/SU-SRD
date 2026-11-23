import { describe, expect, test } from 'bun:test'
import { searchKindQuery } from '../searchKinds'
import {
  matchSearchTokens,
  scoreSearchMatch,
  searchNameWords,
  searchOneSlipAway,
  searchSquashedName,
  searchWordStem,
  suggestSearchQuery,
  tokenizeSearchQuery,
} from '../searchRanking'
import { searchNamesTerm, searchTermScore } from '../searchTerms'

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

describe('a value in brackets, as the books print it (r5 E1)', () => {
  test("'Hot (3)' and 'hot(3)' are read as 'hot 3'", () => {
    expect(tokenizeSearchQuery('Hot (3)')?.tokens).toEqual(['hot', '3'])
    expect(tokenizeSearchQuery('hot(3)')?.tokens).toEqual(['hot', '3'])
    expect(tokenizeSearchQuery('explosive (2)')?.loweredQuery).toBe('explosive 2')
  })

  test("a name's own brackets stay", () => {
    expect(tokenizeSearchQuery('Bite (Bio-Maw)')?.loweredQuery).toBe('bite (bio-maw)')
  })
})

describe('a number after the name (r4 F1)', () => {
  const literal = (text: string) => (token: string) => text.includes(token)

  test("a trait's value is not asked of its text: 'hot 3' matches Hot", () => {
    expect(
      matchSearchTokens(['hot', '3'], ['hot'], literal('hot this weapon runs hot')).matches
    ).toBe(true)
  })

  test('only after the whole name, and only a number', () => {
    expect(matchSearchTokens(['heat', '3'], ['heat', 'spike'], literal('heat spike')).matches).toBe(
      false
    )
    expect(matchSearchTokens(['hot', 'rod'], ['hot'], literal('hot')).matches).toBe(false)
    expect(matchSearchTokens(['3', 'hot'], ['hot'], literal('hot')).matches).toBe(false)
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

  test('a typo of the whole name ranks under every literal name tier, over prose (r3 D1)', () => {
    // 30 for the name read through its slip, less the typo's 15.
    expect(score('hellfire', 'hellfyre', { usedTypo: true })).toBe(15)
    expect(score('heat', 'heet', { usedTypo: true })).toBe(15)
    // Under "every token in the name" (20), with a rules kind's boost too.
    expect(score('heat', 'heet', { usedTypo: true, schemaName: 'guides' })).toBeLessThan(20)
    // Over a hit in the prose alone ("sheet" holds "heet").
    expect(score('heat', 'heet', { usedTypo: true })).toBeGreaterThan(
      score('create a mech', 'heet', { schemaName: 'guides' })
    )
  })

  test('a typo of one word of a longer name stays under every literal hit', () => {
    expect(score('hellfire missiles', 'hellfyre', { usedTypo: true })).toBe(-15)
  })

  test('a phrase players say leads to the page it names (r3 D2)', () => {
    expect(score('long', 'long range')).toBe(90)
    expect(score('close', 'close range')).toBe(90)
    expect(score('medium', 'range bands')).toBe(90)
    expect(score('group initiative', 'who goes first')).toBe(90)
    expect(score('group initiative', 'Who goes first?')).toBe(90)
    expect(score('turn action', 'can i shoot twice')).toBe(90)
    expect(score('mech damage', 'my mech hits 0 sp')).toBe(90)
    // Asked as a whole question, it is the same phrase.
    expect(score('mech damage', 'what happens when my mech hits 0 sp')).toBe(90)
    // One word of a phrase is not the phrase.
    expect(score('group initiative', 'first')).toBe(0)
  })

  test('ORM-only refinements apply only when supplied', () => {
    expect(score('rifle', 'laser', { descriptionText: 'fires a laser' })).toBe(10)
    expect(score('rifle', 'laser', { matchedFieldCount: 2 })).toBe(10)
  })

  test('the looser readings of a name: an alias, no punctuation, another word form', () => {
    expect(score('structure points', 'sp')).toBe(90)
    expect(score('bio-titan', 'biotitan')).toBe(85)
    // The whole name in another form (r7 E1): over every prefix.
    expect(score('overheat', 'overheating')).toBe(60)
    expect(score('salvaging', 'salvage', { schemaName: 'guides' })).toBe(64)
    expect(score('salvaging', 'salvage', { schemaName: 'guides' })).toBeGreaterThan(
      score('salvage condition', 'salvage', { schemaName: 'guides' })
    )
    // Some of a longer name's words in another form.
    expect(score('heat spike', 'spikes')).toBe(20)
    // Under every exact name, over every prefix.
    expect(score('sp', 'sp')).toBe(100)
  })

  test("a question's filler is left out, and the name tiers still read the query as typed", () => {
    expect(score('salvaging', 'how does salvaging work?')).toBe(100)
    expect(score("let's make a deal", "let's make a deal")).toBe(100)
  })

  test('the name, then more words: the thing named stays over a looser hit (r4 F1)', () => {
    expect(score('mule', 'mule sp')).toBe(80)
    expect(score('hot', 'hot 3', { schemaName: 'traits' })).toBe(83)
    // Under an exact name and its looser readings, over a prefix.
    expect(score('mule sp', 'mule sp')).toBe(100)
    expect(score('mule', 'mule sp')).toBeGreaterThan(score('mule sprinter', 'mule sp'))
    // The name's own words, never a word that opens as it does.
    expect(score('mule', 'mules sp')).toBe(0)
  })

  test('a roll table printed inside another entry ranks under its owner (r4 F1)', () => {
    const owner = score('system and software hacker', 'hacker', { schemaName: 'abilities' })
    const table = score('system and software hacker', 'hacker', {
      schemaName: 'roll-tables',
      embedded: true,
    })
    expect(table).toBe(owner - 1)
    // A table under its own heading keeps the rules' place.
    expect(score('critical injury', 'injury', { schemaName: 'roll-tables' })).toBe(27)
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

  test('a whole question is cut back to its key words (r2 H7)', () => {
    expect(tokenizeSearchQuery('what happens when my mech hits 0 sp')).toEqual({
      loweredQuery: 'mech 0 sp',
      tokens: ['mech', '0', 'sp'],
      rawQuery: 'what happens when my mech hits 0 sp',
    })
    expect(tokenizeSearchQuery('my mech has no energy points left?')?.tokens).toEqual([
      'mech',
      'no',
      'energy',
      'points',
      'left',
    ])
    // A short query keeps a rule's own words: "hit" is Hit Points', not a question's.
    expect(tokenizeSearchQuery('hit points')?.tokens).toEqual(['hit', 'points'])
    expect(tokenizeSearchQuery('what is hit')?.tokens).toEqual(['hit'])
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

describe('searchOneSlipAway (r3 D1)', () => {
  test('two neighbours swapped is one slip', () => {
    expect(searchOneSlipAway('exlposive', 'explosive')).toBe(true)
    expect(searchOneSlipAway('hackre', 'hacker')).toBe(true)
  })

  test('a double letter missing or one too many is one slip', () => {
    expect(searchOneSlipAway('chasis', 'chassis')).toBe(true)
    expect(searchOneSlipAway('hackker', 'hacker')).toBe(true)
  })

  test('a swap and another edit are two', () => {
    expect(searchOneSlipAway('hellfyer', 'hellfire')).toBe(false)
    expect(searchOneSlipAway('exlposve', 'explosive')).toBe(false)
  })

  test('matchSearchTokens forgives a swap in a name word', () => {
    expect(matchSearchTokens(['exlposive'], ['explosive'], () => false)).toEqual({
      matches: true,
      usedTypo: true,
    })
  })
})

describe('suggestSearchQuery (r3 D1)', () => {
  const names = ['Railgun', 'Damage', 'Explosive', 'Heat Sink', 'Hacker']

  test('a word no name holds is put right from the names', () => {
    expect(suggestSearchQuery('railgun damge', names)).toBe('railgun damage')
    expect(suggestSearchQuery('explsoiev', names)).toBe('explosive')
  })

  test('a query whose words are all known, or none close, suggests nothing', () => {
    expect(suggestSearchQuery('railgun damage', names)).toBeNull()
    expect(suggestSearchQuery('zzzzzz', names)).toBeNull()
    expect(suggestSearchQuery('   ', names)).toBeNull()
  })

  test('a short word is left alone', () => {
    expect(suggestSearchQuery('het', names)).toBeNull()
  })
})

describe('a rules term inside a phrase (r7 E1)', () => {
  const names = (nameText: string, query: string, schemaName = 'traits') => {
    const q = tokenizeSearchQuery(query)
    if (!q) throw new Error('blank query in test')
    return searchNamesTerm(q, nameText, schemaName)
  }

  test('the term among the words, in any form of them', () => {
    expect(names('overheat', 'overheat mech')).toBe(true)
    expect(names('overheat', 'what happens when my mech overheats')).toBe(true)
    expect(names('move', 'how far can my mech move', 'keywords')).toBe(true)
    expect(names('heat spike', 'what does heat spike do')).toBe(true)
  })

  test('a whole word, never part of one', () => {
    expect(names('heat', 'what happens when my mech overheats', 'keywords')).toBe(false)
    expect(names('heat spike', 'heat check')).toBe(false)
  })

  test('an alias the table says counts as the term', () => {
    expect(names('map movement', 'how far can my mech move', 'guides')).toBe(true)
  })

  test("only the rules' own kinds", () => {
    expect(names('mule', 'can my mule climb', 'chassis')).toBe(false)
  })

  test('the rarer term ranks first, both over prose', () => {
    expect(searchTermScore('traits', 0.02)).toBeGreaterThan(searchTermScore('keywords', 0.5))
    expect(searchTermScore('keywords', 1)).toBeGreaterThan(20)
    expect(searchTermScore('keywords', 0)).toBeLessThan(80)
  })
})

describe('everyday phrasing (r8 G1)', () => {
  test('a word naming a kind is read as the kind, the rest as the query', () => {
    expect(searchKindQuery(tokenizeSearchQuery('engineer class'))).toEqual({
      schemaName: 'classes',
      query: 'engineer',
    })
    expect(searchKindQuery(tokenizeSearchQuery('Railgun systems'))?.schemaName).toBe('systems')
    expect(searchKindQuery(tokenizeSearchQuery('hot trait'))?.query).toBe('hot')
  })

  test('a kind word alone, or none, is not a kind query', () => {
    expect(searchKindQuery(tokenizeSearchQuery('class'))).toBeNull()
    expect(searchKindQuery(tokenizeSearchQuery('heavy laser'))).toBeNull()
    expect(searchKindQuery(null)).toBeNull()
  })

  test('another form of the word finds it: "grapple" finds Grappling', () => {
    const text = 'grappling harpoon fires a hook'
    expect(
      matchSearchTokens(['grapple'], ['grappling', 'harpoon'], (t) => text.includes(t)).matches
    ).toBe(true)
    // A short word is not cut to a stub: "move" never finds "mov…".
    expect(matchSearchTokens(['move'], ['removal'], (t) => 'removal'.includes(t)).matches).toBe(
      false
    )
    const grapple = tokenizeSearchQuery('grapple')
    if (!grapple) throw new Error('blank query in test')
    expect(
      scoreSearchMatch({ ...grapple, nameText: 'grappling harpoon', usedTypo: false })
    ).toBeGreaterThanOrEqual(20)
  })

  test('a typo across a split word is put right: "rail gunn" is Railgun', () => {
    expect(suggestSearchQuery('rail gunn', ['Railgun', 'Rail', 'Heat Sink'])).toBe('railgun')
    expect(suggestSearchQuery('rail gunn', ['Railgun', 'Heat Sink'])).toBe('railgun')
    expect(suggestSearchQuery('heat sinkk', ['Railgun', 'Heat Sink'])).toBe('heat sink')
  })
})
