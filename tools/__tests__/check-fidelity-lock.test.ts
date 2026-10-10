import { describe, expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LockFile } from '../lib/proseFidelity'
import {
  collectProse,
  compareWithLock,
  formatLockEntry,
  parseLockEntry,
  proseHash,
  pruneLock,
  serializeLock,
} from '../lib/proseFidelity'

/**
 * `check-fidelity-lock.ts` gates merges on `fidelity.lock.json`, and the lock
 * is committed on the promise that it carries no book text. Both rest on what
 * is pinned here: which strings count as prose, how they are keyed, and the
 * one narrow entry format.
 */

function fixture(files: Record<string, unknown[]>): string {
  const dir = mkdtempSync(join(tmpdir(), 'fidelity-'))
  for (const [name, rows] of Object.entries(files))
    writeFileSync(join(dir, name), JSON.stringify(rows))
  return dir
}

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
  const items = collectProse(DATA)
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
  const items = collectProse(DATA)
  const full: LockFile = {
    editions: {},
    entries: Object.fromEntries(items.map((i) => [i.key, `${proseHash(i.text)} verbatim`])),
  }

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
    const d = compareWithLock(items, { editions: {}, entries })
    expect(d.unverified.map((u) => [u.item.key, u.was?.hash])).toEqual([
      [first.key, undefined],
      [second.key, '0000000000000000'],
    ])
    expect(d.stale).toEqual(['systems.json#gone.name'])
    expect(d.malformed.map((m) => m.key)).toEqual(['systems.json#bad.name'])
  })

  test('--prune drops only entries for strings that no longer exist', () => {
    const entries = { ...full.entries, 'systems.json#gone.name': `${proseHash('x')} verbatim` }
    expect(pruneLock({ editions: {}, entries }, items).entries).toEqual(full.entries)
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
