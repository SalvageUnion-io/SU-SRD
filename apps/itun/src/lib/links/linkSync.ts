/**
 * What `ShelfSync` and `WiringSync` do to this browser's cache, as pure plans:
 * which served rows to adopt (`planRowSync`), and which links and Game
 * crawlers to adopt or forget (ADR-037).
 *
 * `entities.listWiring` is the server's answer to "every assignment you can
 * see, and every crawler at your tables". These functions turn one answer plus
 * the local cache into the writes that make the cache reflect it — the same
 * "server wins" reconcile `ShelfSync` does for owned rows. They live here, as
 * functions, so the tests assert the rule itself rather than a copy of it
 * (the reason `lib/db/pruneRules.ts` exists too).
 *
 * ## Absence means deleted only where the server spoke
 *
 * A link the server did not return is pruned only when it is **covered**: one
 * of its ends is cached here in a container the answer covers — the caller's
 * shelf (every shelf link is drawn out of one of their own entities, all of
 * which the query reads) or a Game in `gameIds`. A link touching neither is
 * not this answer's to judge and is left alone, and nothing is pruned at all
 * unless `mayPrune` says absence can be trusted (`lib/db/pruneRules.ts`).
 */

import type { Container } from '../container'
import { containerOf } from '../container'
import type { EntityRef } from '../schemas/entity'
import type { SoftLink } from '../schemas/softLink'
import type { EndContainer } from './linkRules'
import { linkKey } from './linkRules'

/** A link row as `entities.listWiring` returns it. */
export type ServedLink = {
  _id: string
  _creationTime: number
  gameId: string | null
  from: EntityRef
  to: EntityRef
  type: SoftLink['type']
}

/** A Game crawler as `entities.listWiring` returns it. */
export type ServedCrawler = {
  appId: string | null
  gameId: string | null
  updatedAt: number
  body: unknown
}

/**
 * The local record for a served link.
 *
 * A server link has no id of its own — its identity is the (type, from, to)
 * triple — so the Convex row id stands in: stable, unique, and the same on
 * every device that syncs it. A link drawn in this browser keeps the id it was
 * minted with; the two never need to agree, because nothing addresses a link
 * by id across the wire.
 */
export function softLinkFromServer(row: ServedLink): SoftLink {
  return {
    id: row._id,
    from: { type: row.from.type, id: row.from.id },
    to: { type: row.to.type, id: row.to.id },
    type: row.type,
    createdAt: new Date(row._creationTime).toISOString(),
  }
}

function covers(where: Container | null, gameIds: ReadonlySet<string>): boolean {
  if (where === null) return false
  return where.kind === 'shelf' || gameIds.has(where.gameId)
}

/** Links to adopt from the server, and local link ids to forget. */
export function planLinkSync(args: {
  local: readonly SoftLink[]
  served: readonly ServedLink[]
  /** The Games the answer covers (`listWiring().gameIds`). */
  gameIds: ReadonlySet<string>
  /** Where a link end lives, from this browser's cache; null when not cached. */
  containerOfEnd: EndContainer
  mayPrune: boolean
}): { adopt: SoftLink[]; prune: string[] } {
  const servedKeys = new Set<string>()
  const adopt: SoftLink[] = []
  const localKeys = new Set(args.local.map(linkKey))
  for (const row of args.served) {
    const key = linkKey(row)
    if (servedKeys.has(key)) continue
    servedKeys.add(key)
    if (!localKeys.has(key)) adopt.push(softLinkFromServer(row))
  }

  if (!args.mayPrune) return { adopt, prune: [] }

  const prune: string[] = []
  const kept = new Set<string>()
  for (const link of args.local) {
    const key = linkKey(link)
    const covered =
      covers(args.containerOfEnd(link.from), args.gameIds) ||
      covers(args.containerOfEnd(link.to), args.gameIds)
    if (!covered) continue
    // One record per link: a second copy of a link the server holds is the
    // residue of a race between a local draw and a sync, and goes too.
    if (servedKeys.has(key) && !kept.has(key)) {
      kept.add(key)
      continue
    }
    prune.push(link.id)
  }
  return { adopt, prune }
}

/** The id a served body carries, or null. */
function bodyId(body: unknown): string | null {
  const id = (body as { id?: unknown } | null)?.id
  return typeof id === 'string' && id.length > 0 ? id : null
}

/**
 * A row as `entities.listMine` serves it. `updatedAt` is the row's version;
 * patterns and the tray have no such column, so theirs is absent.
 */
export type ServedRow = { updatedAt?: number; body: unknown }

/**
 * A served row's version: its `updatedAt` column, or for a pattern or a tray
 * NPC — which have none — the body's own `updatedAt` (else `createdAt`) stamp.
 * Those two are written only by their owner's client, as whole bodies, so the
 * body's stamp moves exactly when the row does. `0` when there is nothing to
 * read, which adopts once and then never again.
 */
export function rowVersion(row: ServedRow): number {
  if (row.updatedAt !== undefined) return row.updatedAt
  const body = (row.body ?? {}) as { updatedAt?: unknown; createdAt?: unknown }
  const stamp = typeof body.updatedAt === 'string' ? body.updatedAt : body.createdAt
  const ms = typeof stamp === 'string' ? Date.parse(stamp) : Number.NaN
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * Served rows to adopt into this browser's cache, one decision per row.
 *
 * A row is adopted when this browser lacks it, has never recorded its version,
 * or holds an older version than the server now serves (`adoptedAt`, keyed by
 * id). Newer, not merely different: an emission that predates a write this
 * browser already made must not be adopted over it.
 *
 * This replaced a stamp of the served **ids**, which re-adopted only when a row
 * was added or removed. An edit made on another device changed no id, so it
 * never came down — and the next whole-body write from here sent the old body
 * back up over it.
 */
export function planRowSync<R extends ServedRow>(args: {
  local: readonly { id: string }[]
  served: readonly R[]
  adoptedAt: ReadonlyMap<string, number>
}): Array<{ id: string; updatedAt: number; row: R }> {
  const localIds = new Set(args.local.map((r) => r.id))
  const seen = new Set<string>()
  const adopt: Array<{ id: string; updatedAt: number; row: R }> = []
  for (const row of args.served) {
    const id = bodyId(row.body)
    if (id === null || seen.has(id)) continue
    seen.add(id)
    const updatedAt = rowVersion(row)
    const known = args.adoptedAt.get(id)
    if (localIds.has(id) && known !== undefined && known >= updatedAt) continue
    adopt.push({ id, updatedAt, row })
  }
  return adopt
}

/**
 * Game crawlers to adopt, and local crawler ids to forget.
 *
 * A crawler is adopted on `planRowSync`'s rule — this browser lacks it, or the
 * server row has moved on since it was last adopted — because the crawler is
 * the crew's, so the Mediator's edit has to reach every member's cache too. The body is stamped with the ROW's container,
 * because the column is the authority (`maintenance.repairContainers`) and a
 * template-seeded body names no Game at all.
 *
 * A local crawler filed in a covered Game that the server no longer returns
 * was scrapped or moved out, and is forgotten — when `mayPrune` allows.
 */
export function planCrawlerSync(args: {
  local: readonly { id: string; gameId?: string | null; workspaceId?: string }[]
  served: readonly ServedCrawler[]
  gameIds: ReadonlySet<string>
  adoptedAt: ReadonlyMap<string, number>
  mayPrune: boolean
}): {
  adopt: Array<{ id: string; updatedAt: number; body: Record<string, unknown> }>
  prune: string[]
} {
  const servedIds = new Set(
    args.served.map((row) => bodyId(row.body)).filter((id): id is string => id !== null)
  )
  const adopt = planRowSync(args).map(({ id, updatedAt, row }) => ({
    id,
    updatedAt,
    body: { ...(row.body as Record<string, unknown>), gameId: row.gameId },
  }))

  if (!args.mayPrune) return { adopt, prune: [] }
  const prune = args.local
    .filter((c) => {
      const where = containerOf(c)
      return where.kind === 'game' && args.gameIds.has(where.gameId) && !servedIds.has(c.id)
    })
    .map((c) => c.id)
  return { adopt, prune }
}
