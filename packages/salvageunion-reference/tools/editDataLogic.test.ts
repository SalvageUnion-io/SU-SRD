import { describe, it, expect } from 'bun:test'
import { parseTree } from 'jsonc-parser'
import { addEntity, setField } from './editDataLogic.js'

/**
 * In-memory fixture (NOT a committed .json file). This is deliberate: the
 * whole point of editDataLogic.ts is producing output the repo's prettier
 * config would reformat (see CLAUDE.md's Data Conventions and
 * editDataLogic.ts's header). A committed fixture would get reformatted by
 * `bun run format` on commit, silently invalidating the byte-identical
 * assertions below. Embedding the fixture as a string sidesteps that
 * entirely — jsonc-parser's modify/applyEdits operate purely on strings.
 */
const FIXTURE = `[
  {
    "id": "aaaa-1111",
    "name": "Alpha",
    "source": "Test Source",
    "page": 10,
    "tags": ["one", "two"]
  },
  {
    "id": "bbbb-2222",
    "name": "Bravo",
    "description": "The second entity.",
    "nested": {
      "foo": "bar"
    }
  },
  {
    "id": "cccc-3333",
    "name": "Charlie",
    "page": 42
  }
]
`

/** Exact source text of each top-level array element, by offset+length. */
function entitySpans(source: string): string[] {
  const tree = parseTree(source)
  if (!tree?.children) throw new Error('fixture did not parse to an array')
  return tree.children.map((child) => source.slice(child.offset, child.offset + child.length))
}

describe('addEntity', () => {
  it('appends a new entity and leaves every existing entity byte-identical', () => {
    const newEntity = { id: 'dddd-4444', name: 'Delta', page: 7 }
    const result = addEntity(FIXTURE, newEntity)

    const originalSpans = entitySpans(FIXTURE)
    const resultSpans = entitySpans(result)

    expect(resultSpans).toHaveLength(4)
    expect(resultSpans[0]).toBe(originalSpans[0])
    expect(resultSpans[1]).toBe(originalSpans[1])
    expect(resultSpans[2]).toBe(originalSpans[2])

    expect(JSON.parse(resultSpans[3]!)).toEqual(newEntity)
    expect(JSON.parse(result)).toEqual([...JSON.parse(FIXTURE), newEntity])
  })

  it('leaves everything up to and including the last original entity byte-identical', () => {
    const result = addEntity(FIXTURE, { id: 'dddd-4444', name: 'Delta' })

    const tree = parseTree(FIXTURE)!
    const lastOriginalChild = tree.children![tree.children!.length - 1]!
    const prefixEnd = lastOriginalChild.offset + lastOriginalChild.length

    expect(result.slice(0, prefixEnd)).toBe(FIXTURE.slice(0, prefixEnd))
  })

  it('preserves the trailing newline at EOF', () => {
    expect(FIXTURE.endsWith('\n')).toBe(true)
    const result = addEntity(FIXTURE, { id: 'x', name: 'X' })
    expect(result.endsWith('\n')).toBe(true)
    expect(result.slice(result.lastIndexOf(']'))).toBe(']\n')
  })

  it('throws on a non-array data file', () => {
    expect(() => addEntity('{}', { id: 'x' })).toThrow()
  })
})

describe('setField', () => {
  it('updates one field on the matched entity and leaves the other entities byte-identical', () => {
    const result = setField(FIXTURE, { id: 'bbbb-2222' }, 'description', 'Updated description.')

    const originalSpans = entitySpans(FIXTURE)
    const resultSpans = entitySpans(result)

    expect(resultSpans).toHaveLength(3)
    expect(resultSpans[0]).toBe(originalSpans[0])
    expect(resultSpans[2]).toBe(originalSpans[2])
    expect(resultSpans[1]).not.toBe(originalSpans[1])

    const parsed = JSON.parse(result)
    expect(parsed[1].description).toBe('Updated description.')
    // Every other field on the edited entity is untouched.
    expect(parsed[1].id).toBe('bbbb-2222')
    expect(parsed[1].name).toBe('Bravo')
    expect(parsed[1].nested).toEqual({ foo: 'bar' })
  })

  it('leaves all text before and after the edited entity byte-identical', () => {
    const result = setField(FIXTURE, { id: 'bbbb-2222' }, 'name', 'Bravo Two')

    const tree = parseTree(FIXTURE)!
    const target = tree.children![1]!
    const beforeOffset = target.offset
    const afterOffset = target.offset + target.length

    // Prefix (entity[0] and everything before entity[1]) is untouched.
    expect(result.slice(0, beforeOffset)).toBe(FIXTURE.slice(0, beforeOffset))

    // Suffix (everything after entity[1]: entity[2], closing bracket, EOF
    // newline) is untouched — compared by content (endsWith), since the
    // edited value's length can differ from the original, shifting absolute
    // offsets without changing the actual bytes of the untouched tail.
    const originalTail = FIXTURE.slice(afterOffset)
    expect(result.endsWith(originalTail)).toBe(true)
  })

  it('matches by name when id is not supplied', () => {
    const result = setField(FIXTURE, { name: 'Charlie' }, 'page', 99)
    expect(JSON.parse(result)[2].page).toBe(99)
  })

  it('adds a field that did not previously exist on the entity', () => {
    const result = setField(FIXTURE, { id: 'aaaa-1111' }, 'newField', 'hello')
    expect(JSON.parse(result)[0].newField).toBe('hello')
  })

  it('throws when no entity matches the given id', () => {
    expect(() => setField(FIXTURE, { id: 'does-not-exist' }, 'page', 1)).toThrow()
  })

  it('throws when no entity matches the given name', () => {
    expect(() => setField(FIXTURE, { name: 'Does Not Exist' }, 'page', 1)).toThrow()
  })

  it('throws on a non-array data file', () => {
    expect(() => setField('{}', { id: 'x' }, 'page', 1)).toThrow()
  })
})
