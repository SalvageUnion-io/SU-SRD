#!/usr/bin/env bun
/**
 * d1-migrate — bring one of su-srd's D1 databases up to `apps/web/migrations`
 * before the Worker that reads it ships.
 *
 * Run by `.github/workflows/deploy-cloudflare.yml` (`su-shared`) and
 * `deploy-preview.yml` (`su-shared-preview`), from `apps/web`:
 *
 *   1. creates the database when the account has none of that name (a new
 *      one's id then goes into `wrangler.jsonc`, which pins both, because a
 *      Preview cannot provision a database by name);
 *   2. applies every migration it has not had, through a one-binding config
 *      naming it, because `wrangler d1 migrations apply` only takes a
 *      database from a config's top-level `d1_databases`, and a Preview's
 *      sits in `previews`.
 *
 * Applying is forward only and idempotent: wrangler records each file it ran
 * in the database's `d1_migrations` table. So a merged migration is never
 * edited, and the old Worker (and a rollback) runs on the new schema:
 * `tools/check-migrations.ts` holds both (docs/ARCHITECTURE.md#deploy).
 *
 * Usage: bun tools/d1-migrate.ts <database_name>
 */

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const WEB = resolve(import.meta.dir, '../apps/web')

/** The databases this may touch: production's and the Previews'. */
const DATABASES = ['su-shared', 'su-shared-preview'] as const

type Run = (args: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>

/** A `Run` over `cmd` (wrangler, or a stub in the tests), from `apps/web`. */
export const runner =
  (cmd: readonly string[]): Run =>
  async (args) => {
    const proc = Bun.spawn([...cmd, ...args], { cwd: WEB, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { exitCode, stdout, stderr }
  }

const wrangler = runner(['bunx', 'wrangler'])

/** The one-binding config `migrations apply` reads, naming `name`. */
export function migrationConfig(name: string): Record<string, unknown> {
  return {
    name: 'su-srd',
    compatibility_date: '2026-07-13',
    d1_databases: [
      { binding: 'SHARED', database_name: name, migrations_dir: join(WEB, 'migrations') },
    ],
  }
}

export async function migrate(name: string, run: Run = wrangler): Promise<void> {
  if (!(DATABASES as readonly string[]).includes(name)) {
    throw new Error(`d1-migrate: ${name} is not one of ${DATABASES.join(', ')}`)
  }
  const info = await run(['d1', 'info', name])
  if (info.exitCode !== 0) {
    if (!/not found|couldn't find/i.test(`${info.stdout}${info.stderr}`)) {
      throw new Error(`d1-migrate: could not read ${name}:\n${info.stderr || info.stdout}`)
    }
    const created = await run(['d1', 'create', name])
    if (created.exitCode !== 0) {
      throw new Error(`d1-migrate: could not create ${name}:\n${created.stderr}`)
    }
    console.log(`d1-migrate: created ${name}`)
  }
  const config = join(mkdtempSync(join(tmpdir(), 'd1-migrate-')), 'wrangler.json')
  writeFileSync(config, JSON.stringify(migrationConfig(name)))
  const applied = await run(['d1', 'migrations', 'apply', 'SHARED', '--remote', '--config', config])
  if (applied.exitCode !== 0) {
    throw new Error(`d1-migrate: migrations failed on ${name}:\n${applied.stderr}`)
  }
  console.log(applied.stdout.trim())
}

/** The CLI: migrate `argv[0]`; returns the exit code. */
export async function cli(
  argv: readonly string[] = process.argv.slice(2),
  run: Run = wrangler,
  error: (line: unknown) => void = console.error
): Promise<number> {
  try {
    await migrate(argv[0] ?? '', run)
    return 0
  } catch (caught) {
    error(caught instanceof Error ? caught.message : caught)
    return 1
  }
}

if (import.meta.main) process.exit(await cli())
