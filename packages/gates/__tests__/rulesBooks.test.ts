import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BOOK_SPECS, pickLatest, readPages } from '../lib/rulesBooks'

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
