#!/usr/bin/env bun
/**
 * bun tools/review-deck/shoot.ts <out-dir> [route-filter,…]
 *
 * Shoots the whole site for the review deck (`apps/web/e2e/review/site.review.ts`)
 * against the dev server `bun run dev:backend` keeps up on this checkout's
 * port: the local Convex backend with the test sign-in, so the spec can seed
 * its own account and shoot the sheets, the Game and Play. Writes
 * <out-dir>/*.jpg and <out-dir>/manifest.jsonl. See README.md.
 */
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { portFor } from 'gates/ports'

const [out, only = ''] = process.argv.slice(2)
if (!out) throw new Error('usage: shoot.ts <out-dir> [route-filter,…]')
const dir = resolve(out)
mkdirSync(dir, { recursive: true })
const base = `http://localhost:${portFor()}`
if (
  !(await fetch(base).then(
    (r) => r.ok,
    () => false
  ))
)
  throw new Error(`nothing answers on ${base}: start \`bun run dev:backend\` first`)

const run = Bun.spawn(['bunx', 'playwright', 'test', '-c', 'review.config.ts'], {
  cwd: join(import.meta.dir, '../../apps/web'),
  stdio: ['inherit', 'inherit', 'inherit'],
  // Node's fetch (the spec's art route) takes the egress proxy only with NODE_USE_ENV_PROXY.
  env: {
    ...process.env,
    NODE_USE_ENV_PROXY: '1',
    REVIEW_OUT: dir,
    REVIEW_ONLY: only,
    E2E_BASE_URL: base,
  },
})
process.exit(await run.exited)
