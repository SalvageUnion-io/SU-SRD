/**
 * The cutover's door : `tools/cutover-run.ts` posts each bundle
 * `tools/convex-copy.ts` wrote, and the Worker imports it into its room,
 * checks the room against it, and writes its D1 rows. `finish` marks the
 * shared database filled, the step that moves every reader onto it.
 *
 * Only a caller holding `CUTOVER_SECRET` gets in; with it unset the door is
 * not there (404). Every step can run again: a room takes its bundle once
 * and the D1 writes are upserts.
 */

import type { AccountBundle, GameBundle } from 'game-domain/migration/bundle'
import {
  AccountBundleSchema,
  GameBundleSchema,
  SiteBundleSchema,
} from 'game-domain/migration/bundle'
import { rooms } from './rooms'
import { projectAccount, projectGame, projectSite } from './shared/cutover'
import type { SharedDb } from './shared/db'
import { markFilled } from './shared/db'

export const CUTOVER_PREFIX = '/admin/cutover/'

/** What a room answers for its import: whether it took the bundle, and where it differs. */
type Imported = { imported: boolean; diff: string[] }

/** The rooms the door reaches; the Worker's own by default, a fake in a test. */
export type CutoverRooms = {
  importAccount(bundle: AccountBundle): Promise<Imported>
  importGame(bundle: GameBundle): Promise<Imported>
}

const workerRooms: CutoverRooms = {
  async importAccount(bundle) {
    const room = rooms().AccountRoom.getByName(bundle.discordId) as unknown as {
      importAccount(b: AccountBundle): Promise<{ imported: boolean }>
      diffImport(b: AccountBundle): Promise<string[]>
    }
    const { imported } = await room.importAccount(bundle)
    return { imported, diff: await room.diffImport(bundle) }
  },
  async importGame(bundle) {
    const room = rooms().GameRoom.getByName(bundle.gameId) as unknown as {
      importGame(b: GameBundle): Promise<{ imported: boolean }>
      diffImport(b: GameBundle): Promise<string[]>
    }
    const { imported } = await room.importGame(bundle)
    return { imported, diff: await room.diffImport(bundle) }
  },
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

/** Equal strings, compared in time that does not depend on where they differ. */
function sameSecret(given: string, secret: string): boolean {
  if (given.length !== secret.length) return false
  let differs = 0
  for (let i = 0; i < secret.length; i++) differs |= given.charCodeAt(i) ^ secret.charCodeAt(i)
  return differs === 0
}

export async function handleCutover(
  request: Request,
  env: { CUTOVER_SECRET?: string; SHARED: SharedDb },
  reach: CutoverRooms = workerRooms,
  now = Date.now()
): Promise<Response> {
  const secret = env.CUTOVER_SECRET
  if (!secret) return json(404, { error: 'not_found' })
  if (!sameSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    return json(401, { error: 'unauthorized' })
  }
  if (request.method !== 'POST') return json(405, { error: 'post_only' })

  const step = new URL(request.url).pathname.slice(CUTOVER_PREFIX.length)
  if (step === 'finish') {
    await markFilled(env.SHARED, now)
    return json(200, { filled: true })
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const bad = (issues: unknown) => json(400, { error: 'bad_bundle', issues })
  if (step === 'account') {
    const parsed = AccountBundleSchema.safeParse(body)
    if (!parsed.success) return bad(parsed.error.issues)
    const answer = await reach.importAccount(parsed.data)
    await projectAccount(env.SHARED, parsed.data, now)
    return json(200, answer)
  }
  if (step === 'game') {
    const parsed = GameBundleSchema.safeParse(body?.bundle)
    const mediatedBy = body?.mediatedBy ?? null
    if (!parsed.success) return bad(parsed.error.issues)
    if (mediatedBy !== null && typeof mediatedBy !== 'string') return bad('mediatedBy')
    const answer = await reach.importGame(parsed.data)
    await projectGame(env.SHARED, parsed.data, mediatedBy, now)
    return json(200, answer)
  }
  if (step === 'site') {
    const parsed = SiteBundleSchema.safeParse(body)
    if (!parsed.success) return bad(parsed.error.issues)
    return json(200, { written: await projectSite(env.SHARED, parsed.data, now) })
  }
  return json(404, { error: 'no_such_step' })
}
