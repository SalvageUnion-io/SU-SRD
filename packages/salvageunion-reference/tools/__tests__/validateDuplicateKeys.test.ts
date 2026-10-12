import { describe, expect, test } from 'bun:test'
import { findDuplicateKeys, findSelfCitations } from '../validateDuplicateKeysLogic'

describe('findDuplicateKeys', () => {
  test('finds a key spelled twice in one object, with its path and lines', () => {
    const text =
      '[\n  {\n    "name": "Goliath",\n    "page": 24,\n    "patterns": [],\n    "page": 4\n  }\n]\n'
    expect(findDuplicateKeys(text)).toEqual([{ path: '[0]', key: 'page', lines: [4, 6] }])
  })

  test('the same key in sibling or nested objects is not a duplicate', () => {
    const text = JSON.stringify([{ page: 1, patterns: [{ page: 2 }, { page: 3 }] }, { page: 4 }])
    expect(findDuplicateKeys(text)).toEqual([])
  })

  test('reports a nested duplicate at its own path', () => {
    const text = '[{"patterns":[{"name":"A","name":"B"}]}]'
    expect(findDuplicateKeys(text)).toEqual([
      { path: '[0].patterns[0]', key: 'name', lines: [1, 1] },
    ])
  })
})

describe('findSelfCitations', () => {
  test('flags an additional source that repeats its own row or pattern citation', () => {
    const pc = { source: 'Salvage Union Starter Set', booklet: 'PC', page: 24 }
    const found = findSelfCitations({
      'chassis.json': [
        { ...pc, additionalSources: [{ source: 'Mech Monday', page: 4 }, pc] },
        {
          source: 'X',
          page: 1,
          patterns: [{ ...pc, additionalSources: [{ ...pc, page: 25 }, pc] }],
        },
      ],
    })
    expect(found.map((f) => f.path)).toEqual([
      '[0].additionalSources[1]',
      '[1].patterns[0].additionalSources[1]',
    ])
  })

  test('the same source on a different page or booklet is a reprint, not a repeat', () => {
    const found = findSelfCitations({
      'systems.json': [
        {
          source: 'Salvage Union Workshop Manual',
          page: 160,
          additionalSources: [
            { source: 'Salvage Union Workshop Manual', page: 161 },
            { source: 'Salvage Union Starter Set', booklet: 'PC', page: 160 },
          ],
        },
      ],
    })
    expect(found).toEqual([])
  })
})
