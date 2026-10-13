import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Committed 1Password reference files stay secret-free.
 *
 * A local script that needs credentials reads them from a committed env file
 * of `op://` references, resolved for one command by
 * `op run --env-file=<file> -- <command>`. Such a file sits one paste away from
 * holding the secret itself, so every value in it must be empty or an `op://`
 * reference. The declared files are always checked; any other tracked env file
 * that carries an `op://` value is checked too, so a new one cannot slip by
 * undeclared.
 */

const ROOT = join(import.meta.dir, '..', '..')

/** The committed reference files, each documented beside the script it feeds. */
const OP_ENV_FILES = ['apps/discord-bot/.env.example', 'tools/r2.op.env']

type Assignment = { line: number; key: string; value: string }

/** `KEY=value` lines, skipping blanks and comments; quotes and `export ` stripped. */
function assignments(text: string): Assignment[] {
  return text.split('\n').flatMap((raw, index) => {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) return []
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match) return [{ line: index + 1, key: '(unparsed)', value: line }]
    const value = (match[2] ?? '').replace(/^(['"])(.*)\1$/, '$2')
    return [{ line: index + 1, key: match[1] ?? '', value }]
  })
}

/** Assignments whose value is neither empty nor a 1Password reference. */
function plaintextValues(text: string): Assignment[] {
  return assignments(text).filter(({ value }) => value !== '' && !value.startsWith('op://'))
}

function trackedEnvFiles(): string[] {
  const out = Bun.spawnSync(['git', 'ls-files', '-z', '--', '*.env', '*.env.*'], { cwd: ROOT })
  if (out.exitCode !== 0) throw new Error(`git ls-files failed: ${out.stderr.toString()}`)
  return out.stdout.toString().split('\0').filter(Boolean)
}

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

describe('plaintextValues', () => {
  test('passes empty values and op:// references', () => {
    expect(plaintextValues('# c\nA=\nB=op://V/i/f\nC="op://V/i/field name"\n')).toEqual([])
  })

  test('flags a literal value, quoted or not, and an unparsable line', () => {
    expect(plaintextValues('A=abc\nexport B="xyz"\nnot an assignment\n')).toEqual([
      { line: 1, key: 'A', value: 'abc' },
      { line: 2, key: 'B', value: 'xyz' },
      { line: 3, key: '(unparsed)', value: 'not an assignment' },
    ])
  })
})

describe('committed op env files', () => {
  const tracked = trackedEnvFiles()
  const discovered = tracked.filter((path) => read(path).includes('op://'))
  const checked = [...new Set([...OP_ENV_FILES, ...discovered])].sort()

  test('every declared file is tracked and holds a reference', () => {
    for (const path of OP_ENV_FILES) {
      expect(tracked).toContain(path)
      expect(discovered).toContain(path)
    }
  })

  test.each(checked)('%s holds only op:// references or empty values', (path) => {
    expect(plaintextValues(read(path))).toEqual([])
  })

  // A reference by item ID breaks silently when the item moves, since a move
  // gives it a new ID. Name the item instead.
  test.each(checked)('%s names its items rather than using item IDs', (path) => {
    const byId = assignments(read(path)).filter(({ value }) =>
      /^op:\/\/[^/]+\/[a-z0-9]{26}\//.test(value)
    )
    expect(byId).toEqual([])
  })
})
