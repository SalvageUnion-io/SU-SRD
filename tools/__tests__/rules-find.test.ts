import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findHits, joinWraps, snippets, sources, termPattern } from '../rules-find'

const temps: string[] = []
afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true })
})

/** An extract directory: file name to its pages. */
function extract(files: Record<string, string[]>, raw: Record<string, string[]> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'rules-find-'))
  temps.push(dir)
  const write = (path: string, pages: string[]) =>
    writeFileSync(path, pages.map((p, i) => `<!-- page ${i + 1} -->\n${p}`).join('\n\n'))
  for (const [name, pages] of Object.entries(files)) write(join(dir, name), pages)
  mkdirSync(join(dir, 'raw'))
  for (const [name, pages] of Object.entries(raw)) write(join(dir, 'raw', name), pages)
  return dir
}

describe('joinWraps', () => {
  test('joins wrapped lines, folds typography, rejoins a split word', () => {
    expect(joinWraps('your Mech’s Heat\nCapacity is 10.\nIt compen-\nsates')).toBe(
      "your Mech's Heat Capacity is 10. It compensates"
    )
  })

  test('keeps the hyphen of a compound split at a line end', () => {
    expect(joinWraps('a Mech-\nTech roll')).toBe('a Mech-Tech roll')
  })
})

describe('termPattern', () => {
  test('matches across a wrap, by prefix, in any case', () => {
    const page = joinWraps('take you over your Heat\nCapacity. HEAT CAP. 7')
    expect(page.match(termPattern('heat cap'))).toEqual(['Heat Cap', 'HEAT CAP'])
  })

  test('matches at a word start only', () => {
    expect('Heat'.match(termPattern('eat'))).toBeNull()
    expect('display'.match(termPattern('SP'))).toBeNull()
    expect('Heat Capacity'.match(termPattern('heat cap'))).toEqual(['Heat Cap'])
  })

  test('escapes regex characters in the term', () => {
    expect('Cargo Cap. 6'.match(termPattern('Cap. 6'))).toEqual(['Cap. 6'])
    expect('Cap 66'.match(termPattern('Cap. 6'))).toBeNull()
  })
})

describe('snippets', () => {
  test('widens a cut to whole words and marks it', () => {
    const text = 'one two three Heat Capacity four five six'
    expect(snippets(text, termPattern('heat'), 3)).toEqual(['…three Heat Capacity…'])
  })

  test('merges hits whose context overlaps; keeps distant hits apart', () => {
    const text = `Heat a Heat ${'x '.repeat(40)}Heat`
    expect(snippets(text, termPattern('heat'), 5)).toHaveLength(2)
  })

  test('no hit, no snippet', () => {
    expect(snippets('nothing here', termPattern('heat'))).toEqual([])
  })
})

describe('sources', () => {
  const files = [
    'Salvage Union Digital Edition 2.0a.txt',
    'Salvage Union Digital Edition 2.0.txt',
    'False Flag Digital Edition 2.0a.txt',
    'We Were Here First Digital Edition 2.0.txt',
    'SUSS Core Rulebook 1.1.txt',
  ]

  test('defaults to the latest edition of each book, when it is 2.0a', () => {
    expect(sources(files, false)).toEqual([
      { label: 'Core Book', file: 'Salvage Union Digital Edition 2.0a.txt' },
      { label: 'False Flag', file: 'False Flag Digital Edition 2.0a.txt' },
    ])
  })

  test('--all takes every text, labelled by file name', () => {
    expect(sources(files, true).map((s) => s.label)).toEqual(files.map((f) => f.slice(0, -4)))
  })
})

describe('findHits', () => {
  const core = 'Salvage Union Digital Edition 2.0a.txt'

  test('cites each hit by book and page', () => {
    const dir = extract({ [core]: ['no hit', 'over your Heat\nCapacity.'] })
    expect(findHits(dir, [{ label: 'Core Book', file: core }], 'heat capacity')).toEqual([
      'Core Book p.2: over your Heat Capacity.',
    ])
  })

  test('reads the raw layer when asked, the flow layer when there is none', () => {
    const blog = 'Mech Monday Blog Posts.txt'
    const dir = extract(
      { [core]: ['Heat Check\ninterleaved'], [blog]: ['a Heat Check'] },
      { [core]: ['the Heat Check'] }
    )
    const searched = [
      { label: 'Core Book', file: core },
      { label: 'Blog', file: blog },
    ]
    expect(findHits(dir, searched, 'heat check', 'raw')).toEqual([
      'Core Book p.1: the Heat Check',
      'Blog p.1: a Heat Check',
    ])
  })
})
