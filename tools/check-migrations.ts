#!/usr/bin/env bun
/**
 * check-migrations — D1 migrations only ever append, and append only what the
 * live Worker can survive (`bun run check migrations`).
 *
 * Production and the Previews apply `apps/web/migrations` through `wrangler d1
 * migrations apply` (tools/d1-migrate.ts), which records each file it ran by
 * NAME and never runs it again. Every test database (`testDb()` under
 * bun:sqlite, `readD1Migrations` under workerd) is built fresh from the files'
 * current text. So an edit to a merged migration passes every suite while
 * production keeps the old schema, and the Worker fails on the missing column
 * after a green deploy. This gate fails when, against `main`:
 *
 *   1. a migration `main` carries was changed or deleted;
 *   2. a new migration's number is not above every number on `main`, is taken
 *      twice, or its name is not `NNNN_snake_case.sql`;
 *   3. a new migration drops or renames a table, view or column without a
 *      `-- contract:` line. The migration runs before the new Worker ships,
 *      under the old one, and a rollback ships old code on the newest schema
 *      (docs/ARCHITECTURE.md#deploy): a drop or rename lands only once no
 *      deployed Worker reads what it removes, and the line says so.
 *
 * `main` is `origin/main`. When the ref is missing (CI's shallow checkout) it
 * is fetched, one commit deep; without it the gate fails in CI and skips with a
 * notice locally.
 *
 * Usage: bun tools/check-migrations.ts
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS = 'apps/web/migrations'
const BASE = 'origin/main'

const NAME = /^(\d{4})_[a-z0-9_]+\.sql$/

/** A statement that removes or renames what a released Worker may still read. */
const DESTRUCTIVE: readonly RegExp[] = [
  /\bdrop\s+(table|view)\b/i,
  /\balter\s+table\s+\S+\s+drop\b/i,
  /\brename\b/i,
]

/** The line that records why a destructive migration is safe to ship now. */
const CONTRACT = /^--\s*contract:\s*\S/m

/** Git's blob id for `text`, as `git hash-object` computes it. */
export function blobId(text: string): string {
  const body = new TextEncoder().encode(text)
  return new Bun.CryptoHasher('sha1').update(`blob ${body.byteLength}\0`).update(body).digest('hex')
}

/** The SQL a statement scan reads: `--` comments removed. */
const withoutComments = (sql: string) => sql.replace(/--[^\n]*/g, '')

/**
 * Every problem with `head` (name → text) against `base` (name → blob id on
 * `main`), one line each.
 */
export function migrationProblems(
  base: ReadonlyMap<string, string>,
  head: ReadonlyMap<string, string>
): string[] {
  const problems: string[] = []
  for (const [name, blob] of base) {
    const text = head.get(name)
    if (text === undefined) problems.push(`${name} is on main and was deleted`)
    else if (blobId(text) !== blob) problems.push(`${name} is on main and was changed`)
  }
  const highest = Math.max(0, ...[...base.keys()].map((n) => Number(n.match(NAME)?.[1] ?? 0)))
  const numbers = new Map<string, string>()
  for (const [name, text] of head) {
    const number = name.match(NAME)?.[1]
    if (number === undefined) {
      problems.push(`${name} is not named NNNN_snake_case.sql`)
      continue
    }
    const taken = numbers.get(number)
    if (taken) problems.push(`${name} reuses ${taken}'s number ${number}`)
    numbers.set(number, name)
    if (base.has(name)) continue
    if (Number(number) <= highest) {
      problems.push(`${name} is new but numbered at or below main's highest (${highest})`)
    }
    const sql = withoutComments(text)
    if (DESTRUCTIVE.some((re) => re.test(sql)) && !CONTRACT.test(text)) {
      problems.push(
        `${name} drops or renames a table, view or column with no \`-- contract:\` line ` +
          'saying no deployed Worker still reads it'
      )
    }
  }
  return problems
}

type Git = (args: string[]) => { ok: boolean; out: string }

const gitIn =
  (cwd: string): Git =>
  (args) => {
    const proc = Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })
    return { ok: proc.exitCode === 0, out: proc.stdout.toString().trim() }
  }

/** name → blob id of each migration on `main`, or null when `main` cannot be read. */
export function baseMigrations(git: Git): Map<string, string> | null {
  if (!git(['rev-parse', '--verify', '--quiet', `${BASE}^{commit}`]).ok) {
    git(['fetch', '--no-tags', '--quiet', '--depth=1', 'origin', `+main:refs/remotes/${BASE}`])
  }
  const tree = git(['ls-tree', BASE, '--', `${MIGRATIONS}/`])
  if (!tree.ok) return null
  const base = new Map<string, string>()
  for (const line of tree.out.split('\n').filter(Boolean)) {
    const match = line.match(/^\d+ blob ([0-9a-f]+)\t.*\/([^/]+)$/)
    if (match?.[1] && match[2]) base.set(match[2], match[1])
  }
  return base
}

/** Run the gate at `root`; returns the exit code. */
export function main(
  root: string,
  {
    git = gitIn(root),
    ci = Boolean(process.env.CI),
    log = console.log,
    error = console.error,
  }: { git?: Git; ci?: boolean; log?: (l: string) => void; error?: (l: string) => void } = {}
): number {
  const dir = join(root, MIGRATIONS)
  const head = new Map(
    (existsSync(dir) ? readdirSync(dir) : [])
      .filter((name) => name.endsWith('.sql'))
      .map((name) => [name, readFileSync(join(dir, name), 'utf8')] as const)
  )
  const base = baseMigrations(git)
  if (base === null) {
    const why = `could not read ${BASE}, so there is nothing to compare ${MIGRATIONS} with`
    if (ci) {
      error(`check-migrations: ${why}`)
      return 1
    }
    log(`check-migrations: SKIPPED locally — ${why} (CI runs it).`)
    return 0
  }
  if (base.size === 0 || head.size === 0) {
    error(`check-migrations: found ${base.size} migration(s) on main and ${head.size} here`)
    return 1
  }
  const problems = migrationProblems(base, head)
  if (problems.length > 0) {
    error(`check-migrations: ${problems.length} problem(s) in ${MIGRATIONS}:`)
    for (const p of problems) error(`  ${p}`)
    return 1
  }
  log(
    `check-migrations: ${base.size} migration(s) on main unchanged; ${head.size - base.size} new, each numbered after them`
  )
  return 0
}

if (import.meta.main) process.exit(main(join(import.meta.dir, '..')))
