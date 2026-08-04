import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseLcov } from './parse-lcov'

/**
 * The ratchet is only worth having if the number it gates on is the
 * workspace's own coverage. These cover the attribution rule — which `SF:`
 * records count — because getting it wrong is silent: the gate still passes,
 * still prints a number, and the number is simply of something else.
 */

/** Write an lcov holding one record per `[path, found, hit]`. */
function lcovWith(records: Array<[string, number, number]>): string {
  const dir = mkdtempSync(join(tmpdir(), 'lcov-'))
  mkdirSync(join(dir, 'coverage'), { recursive: true })
  const body = records
    .map(([file, found, hit]) => `SF:${file}\nLF:${found}\nLH:${hit}\nend_of_record`)
    .join('\n')
  const path = join(dir, 'coverage', 'lcov.info')
  writeFileSync(path, `${body}\n`)
  return path
}

describe('which files a workspace is measured on', () => {
  test('its own source counts', () => {
    const path = lcovWith([['src/a.ts', 100, 80]])
    const root = join(path, '..', '..')
    expect(parseLcov(path, root)).toEqual({ linesFound: 100, linesHit: 80 })
  })

  test('a sibling workspace reached by a single `..` does NOT count', () => {
    // The regression this file exists for. `SF:` is written relative to the
    // workspace root — the cwd of the test run — not to `coverage/`. Resolving
    // against the lcov directory instead left this path at
    // `<workspace>/salvageunion-reference/…`, which looks local, so
    // component-lib was charged for 4,600 lines of the reference package and
    // read 76% against a real 86%. Deeper `../../` paths escaped either way,
    // which is why only the one shallow workspace was ever wrong.
    const path = lcovWith([
      ['src/a.ts', 100, 80],
      ['../salvageunion-reference/lib/utilities.ts', 500, 100],
    ])
    const root = join(path, '..', '..')
    expect(parseLcov(path, root)).toEqual({ linesFound: 100, linesHit: 80 })
  })

  test('a workspace two levels away does not count either', () => {
    const path = lcovWith([
      ['src/a.ts', 100, 80],
      ['../../packages/component-lib/src/b.tsx', 400, 40],
    ])
    const root = join(path, '..', '..')
    expect(parseLcov(path, root)).toEqual({ linesFound: 100, linesHit: 80 })
  })

  test('an absolute path outside the workspace does not count', () => {
    const path = lcovWith([
      ['src/a.ts', 10, 10],
      ['/somewhere/else/c.ts', 999, 0],
    ])
    const root = join(path, '..', '..')
    expect(parseLcov(path, root)).toEqual({ linesFound: 10, linesHit: 10 })
  })

  test('a path that merely starts with the workspace name is not counted as inside it', () => {
    // `<root>-extra` shares a prefix with `<root>` but is a different directory;
    // a string-prefix test would wrongly claim it.
    const path = lcovWith([['../x-extra/src/a.ts', 50, 0]])
    const root = join(path, '..', '..')
    expect(parseLcov(path, root)).toEqual({ linesFound: 0, linesHit: 0 })
  })

  test('records are summed across files, not just read from the first', () => {
    const path = lcovWith([
      ['src/a.ts', 100, 80],
      ['src/b.ts', 100, 40],
    ])
    const root = join(path, '..', '..')
    expect(parseLcov(path, root)).toEqual({ linesFound: 200, linesHit: 120 })
  })

  test('an lcov with nothing of ours yields zero rather than throwing', () => {
    // The caller turns 0/0 into 0% — it must not divide by zero or crash the
    // gate on a workspace whose output is entirely foreign.
    const path = lcovWith([['../other/src/a.ts', 100, 100]])
    const root = join(path, '..', '..')
    expect(parseLcov(path, root)).toEqual({ linesFound: 0, linesHit: 0 })
  })
})
