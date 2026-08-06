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
 * the server of record (ADR-030), where rows are looked up with `.unique()` —
 * so **every player who seeded this roster was carrying the same twelve ids**,
 * and any two of them claiming would collide on all twelve. One would break the
 * other's mirror outright; with the claim now guarded, the second player's
 * starter crew is instead quietly declined. Neither is acceptable, and neither
 * is fixable downstream — the ids have to be distinct at the point of copying.
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
import type { AtomicWriteOp } from '../db'
import { atomicWrite } from '../db'
import { STORE_NAMES } from '../db/stores'
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
 * Spawn the Starter Set roster into this browser. No-op when it is already
 * fully present; when it is partly present, writes only what is missing.
 */
export async function ensureStarterSetSeeded(): Promise<void> {
  const store = useEntityStore.getState()
  await Promise.all(
    (['pilot', 'mech', 'crawler', 'softLink'] as const).map((t) => store.hydrate(t))
  )

  const present = seededRefs()
  if (STARTER_SEED_REFS.every((ref) => present.has(ref))) return

  /*
   * Template slug → the id this device will actually store it under.
   *
   * Built for the whole roster, not just the rows being written, because the
   * soft links have to resolve endpoints that may already be here from an
   * earlier partial seed — under whatever id *that* seed gave them.
   */
  const idFor = new Map<string, string>()
  for (const row of [...store.list('pilot'), ...store.list('mech'), ...store.list('crawler')]) {
    const ref = seedRefOf(row)
    if (ref !== undefined) idFor.set(ref, row.id)
  }
  for (const ref of STARTER_SEED_REFS) {
    if (!idFor.has(ref)) idFor.set(ref, crypto.randomUUID())
  }

  const put = (storeName: string, record: object): AtomicWriteOp => ({
    op: 'put',
    storeName,
    record: record as { id: string },
  })

  /** A template row, restamped with this device's id and its provenance. */
  const spawn = <T extends { id: string }>(row: T): T & { seedRef: string } => ({
    ...row,
    id: idFor.get(row.id) as string,
    seedRef: row.id,
  })

  const writes: AtomicWriteOp[] = [
    ...STARTER_PILOTS.filter((r) => !present.has(r.id)).map((r) =>
      put(STORE_NAMES.pilots, spawn(r))
    ),
    ...STARTER_MECHS.filter((r) => !present.has(r.id)).map((r) => put(STORE_NAMES.mechs, spawn(r))),
    ...STARTER_CRAWLERS.filter((r) => !present.has(r.id)).map((r) =>
      put(STORE_NAMES.crawlers, spawn(r))
    ),
  ]

  /*
   * Links are rebuilt against the remapped endpoints, and skipped when either
   * end is missing from the map — the same rule `mergeImport` follows, and for
   * the same reason: a link to an id that is not here is a dangling reference,
   * which is worse than an absent link.
   *
   * Their own ids stay derived from the endpoints rather than random, so a
   * re-seed cannot lay down a second copy of a link that is already here. A
   * soft link has no independent identity — it *is* its endpoints — and those
   * are now device-unique, so the derived id is too.
   */
  const existingLinkIds = new Set(store.list('softLink').map((l) => l.id))
  for (const link of STARTER_SOFT_LINKS) {
    const from = idFor.get(link.from.id)
    const to = idFor.get(link.to.id)
    if (from === undefined || to === undefined) continue
    const id = `starter-link-${link.type}-${from}-${to}`
    if (existingLinkIds.has(id)) continue
    writes.push(
      put(STORE_NAMES.softLinks, {
        ...link,
        id,
        from: { ...link.from, id: from },
        to: { ...link.to, id: to },
      })
    )
  }

  if (writes.length === 0) return
  await atomicWrite(writes)

  // Reflect the newly-written rows in memory so the roster renders them.
  await Promise.all(
    (['pilot', 'mech', 'crawler', 'softLink'] as const).map((t) =>
      useEntityStore.getState().rehydrate(t)
    )
  )
}
