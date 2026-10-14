import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { LockFile } from '../lib/proseFidelity'
import {
  collectProse,
  collectQuotes,
  compareWithLock,
  formatLockEntry,
  parseLockEntry,
  proseHash,
  pruneLock,
  readLockFile,
  serializeLock,
  toLockFile,
  writeLockFile,
} from '../lib/proseFidelity'

/**
 * `check-fidelity-lock.ts` gates merges on `fidelity.lock.json`, and the lock
 * is committed on the promise that it carries no book text. Both rest on what
 * is pinned here: which strings count as prose, how they are keyed, and the
 * one narrow entry format.
 */

const fixtures: string[] = []
afterAll(() => {
  for (const dir of fixtures) rmSync(dir, { recursive: true, force: true })
})

function fixture(files: Record<string, unknown[]>): string {
  const dir = mkdtempSync(join(tmpdir(), 'fidelity-'))
  fixtures.push(dir)
  for (const [name, rows] of Object.entries(files))
    writeFileSync(join(dir, name), JSON.stringify(rows))
  return dir
}

/** A repo of source files: `{ 'apps/x/src/A.tsx': '…' }`. */
function sourceFixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'fidelity-src-'))
  fixtures.push(dir)
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true })
    writeFileSync(join(dir, name), text)
  }
  return dir
}

const WM = "source: 'Salvage Union Workshop Manual'"
const REPO = sourceFixture({
  'apps/demo/src/Wizard.tsx': `
    const rules = [
      bookQuote({ ${WM}, page: 94 }, 'You start with 20 Tech 1 Scrap.'),
      bookQuote({ ${WM}, booklet: 'CR', page: 3 }, \`Craft a Mech.\`),
      'An unwrapped string the app writes itself.',
    ]
  `,
  'apps/demo/src/__tests__/Wizard.test.tsx': `bookQuote({ ${WM}, page: 1 }, 'In a test.')`,
  'packages/ref/lib/facts.ts': `const hint = bookQuote({ ${WM}, page: 97 }, 'Structure Points.')`,
})

const DATA = fixture({
  'systems.json': [
    {
      id: 'sys-1',
      name: 'Railgun',
      source: 'Salvage Union Workshop Manual',
      page: 180,
      techLevel: 5,
      actions: ['Fire Railgun'],
      content: [
        { type: 'paragraph', value: 'A magnetically propelled weapon.' },
        { type: 'datavalues', value: [{ label: 'Damage', value: '9 SP' }] },
      ],
    },
  ],
  'actions.json': [{ id: 'act-1', name: 'Fire Railgun', content: [{ value: 'Make an attack.' }] }],
  'roll-tables.json': [
    {
      id: 'rt-1',
      name: 'Core Breach',
      source: 'Salvage Union Starter Set',
      booklet: 'CR',
      page: 12,
      table: { '1': { value: 'It explodes.' }, '2-19': { value: '  ' } },
    },
  ],
})

describe('collectProse', () => {
  const items = collectProse(DATA, REPO)
  const keys = items.map((i) => i.key)

  test('keys by entity id and path, so inserting a row moves no key', () => {
    expect(keys).toContain('systems.json#sys-1.content[0].value')
    expect(keys).toContain('systems.json#sys-1.name')
  })

  test('skips enums, ids, blank strings and the stat lines the dataset builds', () => {
    expect(keys.some((k) => k.endsWith('.id') || k.endsWith('.source'))).toBe(false)
    expect(keys.some((k) => k.includes('content[1]'))).toBe(false)
    expect(keys.some((k) => k.includes('2-19'))).toBe(false)
  })

  test('a roll-table row keeps the table field and its booklet anchor', () => {
    const row = items.find((i) => i.key === 'roll-tables.json#rt-1.table.1.value')
    expect(row?.anchors).toEqual([{ source: 'Salvage Union Starter Set', booklet: 'CR', page: 12 }])
  })

  test('an action inherits the anchors of what references it', () => {
    const action = items.find((i) => i.key === 'actions.json#act-1.content[0].value')
    expect(action?.anchors).toEqual([{ source: 'Salvage Union Workshop Manual', page: 180 }])
  })
})

describe('collectQuotes', () => {
  const items = collectQuotes(REPO)

  test('a bookQuote is prose, keyed by file and call order, anchored where it says', () => {
    expect(items.map((i) => [i.key, i.text, i.anchors])).toEqual([
      [
        'apps/demo/src/Wizard.tsx#bookQuote[0]',
        'You start with 20 Tech 1 Scrap.',
        [{ source: 'Salvage Union Workshop Manual', page: 94 }],
      ],
      [
        'apps/demo/src/Wizard.tsx#bookQuote[1]',
        'Craft a Mech.',
        [{ source: 'Salvage Union Workshop Manual', booklet: 'CR', page: 3 }],
      ],
      [
        'packages/ref/lib/facts.ts#bookQuote[0]',
        'Structure Points.',
        [{ source: 'Salvage Union Workshop Manual', page: 97 }],
      ],
    ])
    expect(items.every((i) => i.kind === 'prose' && !i.structural)).toBe(true)
  })

  test('collectProse holds quotes to the lock with the dataset', () => {
    expect(collectProse(DATA, REPO).map((i) => i.key)).toContain(
      'packages/ref/lib/facts.ts#bookQuote[0]'
    )
  })

  test('a call the scan cannot read fails, so no quote passes the gate unseen', () => {
    const cases = [
      `bookQuote({ ${WM}, page: 9 }, \`Deals \${n} SP.\`)`,
      `bookQuote({ ${WM}, page: 9 }, text)`,
      `bookQuote({ ${WM} }, 'No page.')`,
      `bookQuote({ ...anchor, page: 9 }, 'Spread.')`,
      `bookQuote(anchor, 'Not a literal.')`,
    ]
    for (const call of cases)
      expect(() => collectQuotes(sourceFixture({ 'apps/x/src/a.ts': `\n${call}` }))).toThrow(
        'apps/x/src/a.ts:2: bookQuote needs literal arguments'
      )
  })
})

describe('proseHash', () => {
  test('ignores what the book comparison folds away', () => {
    expect(proseHash('It’s a  “Mech” — fast')).toBe(proseHash('It\'s a "Mech" - fast'))
  })
  test('changes with any word', () => {
    expect(proseHash('Deals 3 SP damage.')).not.toBe(proseHash('Deals 4 SP damage.'))
  })
})

describe('lock entries', () => {
  test('round-trip', () => {
    const e = { hash: '0123456789abcdef', verdict: 'unverified', reason: 'paraphrase' } as const
    expect(parseLockEntry(formatLockEntry(e))).toEqual(e)
  })

  test('refuse anything that could carry book text', () => {
    expect(parseLockEntry('0123456789abcdef verbatim A magnetically propelled')).toBeString()
    expect(parseLockEntry('0123456789abcdef verbatim made-up-reason')).toBeString()
    expect(parseLockEntry('0123456789abcdef approved')).toBeString()
    expect(parseLockEntry({ hash: '0123456789abcdef', verdict: 'verbatim' })).toBeString()
  })
})

describe('compareWithLock', () => {
  const items = collectProse(DATA, REPO)
  const comment = JSON.parse(serializeLock({ editions: {}, entries: {} })).$comment as string
  const full = {
    $comment: comment,
    editions: { 'Core Book': 'Salvage Union Digital Edition 2.0a' },
    entries: Object.fromEntries(items.map((i) => [i.key, `${proseHash(i.text)} verbatim`])),
  } as LockFile

  test('passes a lock that covers every string', () => {
    const d = compareWithLock(items, full)
    expect([d.unverified.length, d.stale.length, d.malformed.length]).toEqual([0, 0, 0])
  })

  test('fails a new string, an edited string, a stale entry and a malformed one', () => {
    const [first, second] = items
    if (!first || !second) throw new Error('fixture yielded too few strings')
    const entries = { ...full.entries }
    delete entries[first.key]
    entries[second.key] = '0000000000000000 verbatim'
    entries['systems.json#gone.name'] = `${proseHash('x')} verbatim`
    entries['systems.json#bad.name'] = 'verbatim'
    const d = compareWithLock(items, { ...full, entries })
    expect(d.unverified.map((u) => [u.item.key, u.was?.hash])).toEqual([
      [first.key, undefined],
      [second.key, '0000000000000000'],
    ])
    expect(d.stale).toEqual(['systems.json#gone.name'])
    expect(d.malformed.map((m) => m.key)).toEqual(['systems.json#bad.name'])
  })

  test('--prune drops only entries for strings that no longer exist', () => {
    const entries = { ...full.entries, 'systems.json#gone.name': `${proseHash('x')} verbatim` }
    expect(pruneLock({ ...full, entries }, items).entries).toEqual(full.entries)
  })

  test('fails free text outside entries: an edition, the comment, an extra key', () => {
    const bad = {
      ...full,
      $comment: 'hand-written',
      extra: 'x',
      editions: {
        'Core Book': 'A magnetically propelled ballistic weapon that fires, at range, a slug.',
      },
    } as LockFile
    expect(
      compareWithLock(items, bad)
        .malformed.map((m) => m.key)
        .sort()
    ).toEqual(['$comment', 'editions.Core Book', 'extra'])
  })
})

test('serializeLock sorts keys and writes one entry per line', () => {
  const out = serializeLock({
    editions: { b: '2', a: '1' },
    entries: { 'z#1.name': 'x', 'a#1.name': 'y' },
  })
  expect(out.indexOf('"a#1.name"')).toBeLessThan(out.indexOf('"z#1.name"'))
  expect(out).toContain('\n    "a#1.name": "y",\n')
  expect(out.endsWith('}\n')).toBe(true)
})

describe('the lock file on disk', () => {
  test('a missing or unparseable lock reads as absent, not as an empty lock', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fidelity-lock-'))
    fixtures.push(dir)
    expect(readLockFile(join(dir, 'missing.json'))).toBeUndefined()
    writeFileSync(join(dir, 'broken.json'), '{ not json')
    expect(readLockFile(join(dir, 'broken.json'))).toBeUndefined()
  })

  test('a lock round-trips through toLockFile, writeLockFile and readLockFile', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fidelity-lock-'))
    fixtures.push(dir)
    const path = join(dir, 'fidelity.lock.json')
    const entries = new Map([
      ['systems/b@stat', { hash: 'bbbbbbbbbbbb', verdict: 'verbatim' as const }],
      ['abilities/a', { hash: 'aaaaaaaaaaaa', verdict: 'verbatim' as const }],
    ])
    writeLockFile(toLockFile({ editions: { 'Core Book': 'Edition 2.0a' }, entries }), path)
    const read = readLockFile(path)
    expect(read?.editions).toEqual({ 'Core Book': 'Edition 2.0a' })
    expect(read?.entries).toEqual({
      'abilities/a': 'aaaaaaaaaaaa verbatim',
      'systems/b@stat': 'bbbbbbbbbbbb verbatim',
    })
    // Written sorted, so the committed file diffs one entry at a time.
    const keys = Object.keys(read?.entries ?? {})
    expect(keys).toEqual([...keys].sort())
  })
})
