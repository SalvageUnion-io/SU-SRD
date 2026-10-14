import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BOOK_SPECS, pickFiles, pickLatest, readPages } from '../lib/rulesBooks'

const temps: string[] = []
afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true })
})

describe('pickLatest', () => {
  test('takes the latest edition of a book, every file of a series', () => {
    const picked = pickLatest([
      'Salvage Union Digital Edition 2.0.txt',
      'Salvage Union Digital Edition 2.0a.txt',
      'Mech Monday Mule Patterns.txt',
      'Mech Monday Blog Posts.txt',
    ])
    const byId = (id: string) => picked.get(BOOK_SPECS.find((s) => s.id === id) as never)
    expect(byId('Core Book')).toEqual(['Salvage Union Digital Edition 2.0a.txt'])
    expect(byId('Mech Monday')).toHaveLength(2)
  })
})

describe('Mech Monday scope', () => {
  const spec = BOOK_SPECS.find((s) => s.id === 'Mech Monday')

  test('a chassis file scopes to its chassis; the blog posts scope to none', () => {
    expect(spec?.scopeOf?.('Mech Monday Mule Patterns.txt')).toBe('mule')
    expect(spec?.scopeOf?.('Mech Monday Goliath Template.txt')).toBe('goliath')
    expect(spec?.scopeOf?.('Mech Monday Blog Posts.txt')).toBeUndefined()
  })
})

describe('pickFiles', () => {
  test('reads only the .txt extracts in a directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rules-pick-'))
    temps.push(dir)
    for (const f of [
      'Salvage Union Digital Edition 2.0a.txt',
      'Salvage Union Digital Edition 2.0a.pdf',
      'notes.md',
    ])
      writeFileSync(join(dir, f), '')
    const core = BOOK_SPECS.find((s) => s.id === 'Core Book')
    const picked = pickFiles(dir)
    expect(core && picked.get(core)).toEqual(['Salvage Union Digital Edition 2.0a.txt'])
    expect([...picked.values()].flat()).toEqual(['Salvage Union Digital Edition 2.0a.txt'])
  })
})

describe('readPages', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rules-books-'))
  temps.push(dir)
  const path = join(dir, 'book.txt')
  writeFileSync(path, '<!-- page 1 -->\nHeat Cap\n12\nB\n\n<!-- page 2 -->\nprose')

  test('splits at page markers', () => {
    const pages = readPages(path)
    expect([...pages.keys()]).toEqual([1, 2])
    expect(pages.get(1)).toContain('12')
  })

  test('dropGlyphs removes layout-glyph lines and keeps prose', () => {
    expect(readPages(path, { dropGlyphs: true }).get(1)?.trim()).toBe('Heat Cap')
  })
})
