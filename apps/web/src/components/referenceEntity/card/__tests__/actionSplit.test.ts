import { describe, expect, test } from 'bun:test'
import { splitActions, wordCount } from '../actionSplit'

const words = (n: number) => 'x'.repeat(n)
const act = (name: string, n: number) => ({ id: name, name, content: [{ value: words(n) }] })

describe('wordCount', () => {
  test('counts the words a record carries, never its identity or links', () => {
    expect(wordCount({ id: 'abc', name: 'Patch', source: 'Core', actions: ['Weld'] })).toBe(0)
    expect(wordCount({ name: 'Patch', content: [{ type: 'p', value: 'hello' }] })).toBe(6)
  })
})

describe('splitActions', () => {
  test('a Page with words to it keeps its actions in the side track', () => {
    const entity = { content: [{ value: words(400) }] }
    const actions = [act('a', 100), act('b', 100)]
    expect(splitActions(entity, actions)).toEqual({ main: [], side: actions })
  })

  test('one action stands in the side track however short the words', () => {
    const actions = [act('a', 400)]
    expect(splitActions({ content: [{ value: words(20) }] }, actions)).toEqual({
      main: [],
      side: actions,
    })
  })

  test('a Page that is mostly actions splits them, book order kept, the side never empty', () => {
    const entity = { content: [{ value: words(50) }] }
    const actions = [act('a', 100), act('b', 100), act('c', 100), act('d', 100)]
    const { main, side } = splitActions(entity, actions)
    expect(main.map((a) => a.name)).toEqual(['a', 'b'])
    expect(side.map((a) => a.name)).toEqual(['c', 'd'])
  })

  test('with no words at all the side still takes the last action', () => {
    const actions = [act('a', 100), act('b', 100)]
    const { main, side } = splitActions({}, actions)
    expect(main.map((a) => a.name)).toEqual(['a'])
    expect(side.map((a) => a.name)).toEqual(['b'])
  })
})
