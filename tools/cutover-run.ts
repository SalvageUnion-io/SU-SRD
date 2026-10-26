/**
 * The 4.5.0 cutover's runner: posts every bundle that
 * `tools/convex-copy.ts` wrote to a deployment's cutover door
 * (`apps/web/src/worker/cutover.ts`), then writes the diff report. Only with
 * `--finish`, and only when every room matched its bundle, does it mark the
 * shared database filled, which moves every reader onto it.
 *
 *   CUTOVER_SECRET=… bun tools/cutover-run.ts <bundle-dir> <origin> [--finish]
 *
 * Safe to run again: a room takes its bundle once and the D1 writes are
 * upserts. Deleted with `convex-copy.ts` once the sweep and its diff are clean.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AccountBundle, GameBundle } from 'game-domain/migration/bundle'

/** Bundles in flight at once: enough to finish in minutes, few enough not to crowd the rooms. */
const PARALLEL = 8

type Post = (step: string, body: unknown) => Promise<unknown>

/** One room's line in the report: what it said, or why the post failed. */
type RoomReport = { room: string; imported?: boolean; diff: string[] }

export type RunReport = {
  site: unknown
  rooms: RoomReport[]
  /** Rooms that differ from their bundle, or whose post failed. */
  differing: number
  filled: boolean
}

function readJson<T>(dir: string, sub: string): T[] {
  let files: string[]
  try {
    files = readdirSync(join(dir, sub)).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
  return files.sort().map((f) => JSON.parse(readFileSync(join(dir, sub, f), 'utf8')) as T)
}

/** Runs `task` over `items`, `PARALLEL` at a time, in order of the answers. */
async function each<T, R>(items: T[], task: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await task(items[i] as T)
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, worker))
  return out
}

/** The Mediator's display name for a Game, from the accounts' bundles. */
function mediatorName(game: GameBundle, names: Map<string, string | null>): string | null {
  const mediator = game.members.find((m) => m.mediator)
  return mediator ? (names.get(mediator.discordId) ?? null) : null
}

async function room(label: string, send: () => Promise<unknown>): Promise<RoomReport> {
  try {
    const answer = (await send()) as { imported: boolean; diff: string[] }
    return { room: label, imported: answer.imported, diff: answer.diff }
  } catch (error) {
    return { room: label, diff: [`post failed: ${(error as Error).message}`] }
  }
}

/** Posts the site, every account and every Game; marks D1 filled when asked and clean. */
export async function run(dir: string, post: Post, finish: boolean): Promise<RunReport> {
  const accounts = readJson<AccountBundle>(dir, 'accounts')
  const games = readJson<GameBundle>(dir, 'games')
  const names = new Map(accounts.map((a) => [a.discordId, a.name]))

  const site = await post('site', JSON.parse(readFileSync(join(dir, 'site.json'), 'utf8')))
  const rooms = [
    ...(await each(accounts, (a) => room(`account ${a.discordId}`, () => post('account', a)))),
    ...(await each(games, (g) =>
      room(`game ${g.gameId}`, () =>
        post('game', { bundle: g, mediatedBy: mediatorName(g, names) })
      )
    )),
  ]
  const differing = rooms.filter((r) => r.diff.length > 0).length
  const filled = finish && differing === 0
  if (filled) await post('finish', {})
  return { site, rooms, differing, filled }
}

/** A `Post` to `origin`'s cutover door, failing on any answer but 200. */
export function poster(origin: string, secret: string, fetchImpl = fetch): Post {
  return async (step, body) => {
    const res = await fetchImpl(new URL(`/admin/cutover/${step}`, origin), {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`${step}: ${res.status} ${await res.text()}`)
    return res.json()
  }
}

/** The command line; exit code 1 on a usage error or any differing room. */
export async function main(args: string[], env = process.env): Promise<number> {
  const [dir, origin] = args.filter((a) => !a.startsWith('--'))
  const secret = env.CUTOVER_SECRET
  if (!dir || !origin || !secret) {
    console.error(
      'usage: CUTOVER_SECRET=… bun tools/cutover-run.ts <bundle-dir> <origin> [--finish]'
    )
    return 1
  }
  const report = await run(dir, poster(origin, secret), args.includes('--finish'))
  writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 2))
  console.log(
    JSON.stringify({
      rooms: report.rooms.length,
      differing: report.differing,
      filled: report.filled,
    })
  )
  return report.differing === 0 ? 0 : 1
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)))
