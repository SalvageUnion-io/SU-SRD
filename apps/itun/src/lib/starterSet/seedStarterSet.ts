/**
 * On-demand seeding of the built-in Starter Set roster.
 *
 * The roster is NOT seeded eagerly (no DB migration). It is spawned into THIS
 * browser's IndexedDB when the user asks for it from the Roster, written in one
 * transaction from the static records in `./starterSet`, after which the stores
 * rehydrate so the crew appears immediately.
 *
 * ## It lands on the Shelf
 *
 * It used to live in its own Workspace, which is what kept it from mixing into
 * the user's own builds. Workspaces are gone (ADR-030 §2) and the two remaining
 * containers are a shared Game and the personal Shelf — a Solo user has only
 * the latter, and a pre-built sample roster is not a shared campaign. So the
 * Shelf is where it goes, and the isolation it used to get from its own
 * container it no longer has. That is the honest consequence of the container
 * model rather than a regression to design around: the seed is opt-in, and
 * every seeded row is individually deletable.
 *
 * ## Every seeded row gets a fresh UUID
 *
 * A seeded entity is a **copy of a template**, and a copy is a new thing — so
 * it is minted here exactly like anything the user builds, and the template's
 * slug is recorded as `seedRef` instead.
 *
 * This used to write the template's own ids (`starter-pilot-bonesaw`, …)
 * straight through, because id equality was doubling as the idempotence guard:
 * a `put` of a fixed id overwrites, so a double-click could not duplicate. That
 * reasoning was sound while the ids never left the device, and it stopped being
 * sound the moment accounts landed. A seeded row's `id` becomes its `appId` on
 * the server of record (ADR-030) — so **every player who seeded this roster was
 * carrying the same twelve ids**, and any two of them claiming collided on all
 * twelve.
 *
 * What that collision costs has changed once already, which is the argument for
 * fixing it at the source rather than downstream. It began as an outright break
 * (the lookup used `.unique()`, so it threw and the mirror stopped); the claim
 * is now guarded, so the second player's starter crew is declined instead; and
 * `byAppId` now resolves a duplicate to the *oldest* row, which means a write
 * from the second player aims at the first player's entity and is refused by
 * `assertMayWrite` as somebody else's. Three mechanisms, one outcome: a player
 * whose sheet quietly stops reaching the server. The ids have to be distinct at
 * the point of copying.
 *
 * ## Idempotence, without borrowing identity for it
 *
 * The guard is still the presence of the seeded rows themselves rather than a
 * flag, and for the original reason: with no container record to test, the
 * roster IS the evidence, so a partially-deleted set re-seeds to whole while an
 * intact one is skipped. What changed is what "present" is asked of — `seedRef`
 * rather than `id`. Only the missing rows are written, so re-running adds what
 * was deleted and touches nothing else.
 *
 * Rows seeded before this change carry the old fixed ids and no `seedRef`;
 * migration 14 stamps them, so an existing roster still reads as present and is
 * not seeded a second time. Their ids are deliberately left alone — re-minting
 * them would orphan any server rows already mirrored under the old id.
 */

import { useEntityStore } from '../../stores/entityStore'
import { STARTER_CRAWLERS, STARTER_MECHS, STARTER_PILOTS, STARTER_SOFT_LINKS } from './starterSet'

/** Every template row that carries a `seedRef`, by the slug it is known by. */
export const STARTER_SEED_REFS: readonly string[] = [
  ...STARTER_PILOTS.map((r) => r.id),
  ...STARTER_MECHS.map((r) => r.id),
  ...STARTER_CRAWLERS.map((r) => r.id),
]

/** The template slug a stored row came from, however it was seeded. */
function seedRefOf(row: { id: string; seedRef?: string }): string | undefined {
  // The `id` fallback is for rows written before seeding minted UUIDs, on a
  // device migration 14 has not touched yet. Cheap, and it keeps the "already
  // seeded?" answer correct rather than merely usually correct.
  if (row.seedRef !== undefined) return row.seedRef
  return STARTER_SEED_REFS.includes(row.id) ? row.id : undefined
}

/** Template slugs already present in this browser, across all three kinds. */
function seededRefs(): Set<string> {
  const store = useEntityStore.getState()
  const refs = new Set<string>()
  for (const row of [...store.list('pilot'), ...store.list('mech'), ...store.list('crawler')]) {
    const ref = seedRefOf(row)
    if (ref !== undefined) refs.add(ref)
  }
  return refs
}

/** Whether every Starter Set row is already present in this browser. */
export function isStarterSetSeeded(): boolean {
  const present = seededRefs()
  return STARTER_SEED_REFS.every((ref) => present.has(ref))
}

/**
 * Copy the Starter Set into this account as ordinary personal records.
 *
 * **The templates are REFERENCE data, not a roster.** They ship with the app and
 * belong to nobody; this turns a copy of them into records the player owns, the
 * same as anything they build themselves. Idempotent: rows already copied here
 * (identified by `seedRef`) are skipped, so a second press adds nothing.
 *
 * ## Why this stopped being a bulk `atomicWrite`
 *
 * It used to write the whole set straight to IndexedDB in one transaction —
 * no `requireWritableBackend()`, no commit, bypassing `dbStoreFor` entirely.
 * Under ADR-034 that produced three separate wrongs:
 *
 *   - signed in, the rows were shelf records the server had never seen, so
 *     `ShelfSync` correctly read them as "deleted elsewhere" and **pruned the
 *     Starter Set away** on the next sync;
 *   - anonymous under `VITE_REQUIRE_ACCOUNT` it wrote durably to disk while
 *     `rehydrate` read the in-memory store, so the copy simply never appeared;
 *   - Disconnected it wrote regardless, which read-only is supposed to forbid.
 *
 * Routing every row through `entityStore.create` fixes all three at once: that
 * path refuses when writes are blocked, picks the right backend, and commits to
 * the server of record before touching disk.
 *
 * ## Ids come from the store, not from the template
 *
 * `create` mints its own id, which is why the entities are copied first and the
 * soft links built afterwards from what came back. That is simpler than the old
 * pre-computed remap AND safer: a link can only ever be built from an id that
 * really landed, so a dangling endpoint is unrepresentable rather than merely
 * guarded against.
 */
export async function copyStarterSetToRoster(): Promise<void> {
  const store = useEntityStore.getState()
  await Promise.all(
    (['pilot', 'mech', 'crawler', 'softLink'] as const).map((t) => store.hydrate(t))
  )

  const present = seededRefs()

  /** Template id → the id this account actually stored the copy under. */
  const copiedId = new Map<string, string>()
  for (const row of [...store.list('pilot'), ...store.list('mech'), ...store.list('crawler')]) {
    const ref = seedRefOf(row)
    if (ref !== undefined) copiedId.set(ref, row.id)
  }

  const kinds = [
    ['pilot', STARTER_PILOTS],
    ['mech', STARTER_MECHS],
    ['crawler', STARTER_CRAWLERS],
  ] as const

  for (const [type, rows] of kinds) {
    for (const row of rows) {
      if (present.has(row.id)) continue
      // `id`/`createdAt`/`updatedAt` are the store's to mint — a copy is a NEW
      // record, and reusing the template id would put one id in two accounts.
      // `seedRef` keeps the provenance, which is what it is for.
      const {
        id: templateId,
        createdAt: _c,
        updatedAt: _u,
        ...rest
      } = row as Record<string, unknown> & {
        id: string
        createdAt?: unknown
        updatedAt?: unknown
      }
      const created = await store.create(type, {
        ...rest,
        seedRef: templateId,
      } as never)
      copiedId.set(templateId, created.id)
    }
  }

  /*
   * Deduped by ENDPOINTS, not by id.
   *
   * The old writer derived a stable id (`starter-link-<type>-<from>-<to>`) and
   * skipped on that. `create` mints its own id, so a derived one never matches
   * anything actually stored and every call laid down a second full set of
   * links — caught by the existing idempotence test, which is exactly what it
   * is for.
   *
   * Endpoints are the better key regardless: a soft link has no independent
   * identity, it IS its endpoints, so this cannot drift from what uniqueness
   * actually means here.
   */
  const linkKey = (type: string, from: string, to: string) => `${type}|${from}|${to}`
  const existingLinks = new Set(
    store.list('softLink').map((l) => linkKey(l.type, l.from.id, l.to.id))
  )
  for (const link of STARTER_SOFT_LINKS) {
    const from = copiedId.get(link.from.id)
    const to = copiedId.get(link.to.id)
    // A link to an id that is not here is a dangling reference, which is worse
    // than an absent link — the same rule `mergeImport` follows.
    if (from === undefined || to === undefined) continue
    if (existingLinks.has(linkKey(link.type, from, to))) continue
    await store.create('softLink', {
      ...link,
      from: { ...link.from, id: from },
      to: { ...link.to, id: to },
    } as never)
    existingLinks.add(linkKey(link.type, from, to))
  }
}
