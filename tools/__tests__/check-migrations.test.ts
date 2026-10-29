import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { baseMigrations, blobId, main, migrationProblems } from '../check-migrations'

const ROOT = join(import.meta.dir, '..', '..')

const CREATE = 'create table a (id text primary key);\n'
const base = new Map([['0001_a.sql', blobId(CREATE)]])
const head = (extra: Record<string, string> = {}) =>
  new Map(Object.entries({ '0001_a.sql': CREATE, ...extra }))

describe('check-migrations — migrationProblems', () => {
  test('an untouched history with a new, higher migration passes', () => {
    expect(migrationProblems(base, head({ '0002_b.sql': 'create table b (id text);' }))).toEqual([])
  })

  test('blobId is the id git gives the file', () => {
    const proc = Bun.spawnSync(['git', 'hash-object', '--stdin'], { stdin: Buffer.from(CREATE) })
    expect(blobId(CREATE)).toBe(proc.stdout.toString().trim())
  })

  test('an edited migration from main fails', () => {
    const edited = new Map([['0001_a.sql', `${CREATE}alter table a add column b text;\n`]])
    expect(migrationProblems(base, edited)).toEqual(['0001_a.sql is on main and was changed'])
  })

  test('a deleted migration from main fails', () => {
    expect(migrationProblems(base, new Map([['0002_b.sql', 'select 1;']]))).toEqual([
      '0001_a.sql is on main and was deleted',
    ])
  })

  test('a new migration numbered at or below main fails, and so does a reused number', () => {
    const later = new Map([...base, ['0005_e.sql', blobId('select 1;')]])
    const problems = migrationProblems(
      later,
      new Map([
        ['0001_a.sql', CREATE],
        ['0005_e.sql', 'select 1;'],
        ['0003_c.sql', 'select 1;'],
        ['0006_f.sql', 'select 1;'],
        ['0006_g.sql', 'select 1;'],
      ])
    )
    expect(problems).toEqual([
      "0003_c.sql is new but numbered at or below main's highest (5)",
      "0006_g.sql reuses 0006_f.sql's number 0006",
    ])
  })

  test('a misnamed migration fails', () => {
    expect(migrationProblems(base, head({ 'b.sql': 'select 1;' }))).toEqual([
      'b.sql is not named NNNN_snake_case.sql',
    ])
  })

  test.each([
    'drop table a;',
    'DROP VIEW v;',
    'alter table a drop column b;',
    'alter table a drop b;',
    'alter table a rename to b;',
    'alter table a rename column b to c;',
  ])('a new migration that removes what the live Worker reads needs a contract line: %s', (sql) => {
    expect(migrationProblems(base, head({ '0002_b.sql': sql }))).toHaveLength(1)
    const stated = `-- contract: no Worker since 4.5.0 reads it\n${sql}`
    expect(migrationProblems(base, head({ '0002_b.sql': stated }))).toEqual([])
  })

  test('additive statements, an index drop and the words in a comment pass', () => {
    const sql =
      '-- we never drop table rows here\ndrop index a_by_b;\nalter table a add column c text;'
    expect(migrationProblems(base, head({ '0002_b.sql': sql }))).toEqual([])
  })
})

describe('check-migrations — main', () => {
  const quiet = { log: () => {}, error: () => {} }

  test('the repository passes against its own main', () => {
    expect(main(ROOT, { ...quiet, ci: false })).toBe(0)
  })

  test('an unreadable main skips locally and fails in CI', () => {
    const git = () => ({ ok: false, out: '' })
    expect(main(ROOT, { ...quiet, git, ci: false })).toBe(0)
    expect(main(ROOT, { ...quiet, git, ci: true })).toBe(1)
  })

  test('an empty main is a failure, not a pass', () => {
    const git = () => ({ ok: true, out: '' })
    expect(main(ROOT, { ...quiet, git })).toBe(1)
  })

  test('a changed file on main is reported', () => {
    const lines: string[] = []
    const git = (args: string[]) =>
      args[0] === 'ls-tree'
        ? {
            ok: true,
            out: `100644 blob ${'0'.repeat(40)}\tapps/web/migrations/0001_shared_reads.sql`,
          }
        : { ok: true, out: '' }
    expect(main(ROOT, { log: () => {}, error: (l) => lines.push(l), git })).toBe(1)
    expect(lines).toContain('  0001_shared_reads.sql is on main and was changed')
  })

  test('a missing main ref is fetched before it is read', () => {
    const calls: string[] = []
    const git = (args: string[]) => {
      calls.push(args[0] ?? '')
      return { ok: args[0] !== 'rev-parse', out: '' }
    }
    baseMigrations(git)
    expect(calls).toEqual(['rev-parse', 'fetch', 'ls-tree'])
  })
})
