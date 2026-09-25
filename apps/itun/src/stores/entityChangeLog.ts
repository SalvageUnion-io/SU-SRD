/**
 * The entity store's Change Log emitter (ADR-022) — split out of
 * `entityStore.ts` (audit AP-16) because it is a self-contained concern: given
 * a write's before/after images, work out which fields moved and append one
 * provenance row per field, locally and to the server of record.
 */

import { containerOf } from '../lib/container'
import * as db from '../lib/db/index'
import { captureException } from '../lib/observability'
import type { ChangeLogKind } from '../lib/schemas/changeLog'
import { commitChangeLog } from './entityBackend'
import type { EntityForType, EntityType } from './types'

/**
 * Provenance tags for a Change Log entry (ADR-022).
 *
 * Both fields are required, and so is the parameter that carries them. The
 * earlier all-optional shape meant a forgotten tag was not a compile error but a
 * Change Log line reading `manual` / `unknown` — indistinguishable from a real
 * hand edit, and invisible until somebody read the drawer and disbelieved it.
 * Declare the tag once per surface in `surfaceProvenance.ts` and pass the
 * constant.
 */
export type ChangeMeta = {
  kind: ChangeLogKind
  source: string
}

/** Structural equality via JSON — entity fields are Zod-parsed, so key order is stable. */
function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * The fields a patch actually changed: for each key in `patch`, compare the
 * before-image against the persisted result and keep only the ones that moved.
 * `before` is null when the entity was not in memory at write time (the entry's
 * `before` is then undefined — best-effort provenance, see ADR-022).
 */
function changedFields<T extends EntityType>(
  patch: Partial<EntityForType<T>>,
  before: EntityForType<T> | null,
  after: EntityForType<T>
): Array<{ field: string; before: unknown; after: unknown }> {
  const beforeRec = (before ?? {}) as Record<string, unknown>
  const afterRec = after as Record<string, unknown>
  const changes: Array<{ field: string; before: unknown; after: unknown }> = []
  for (const field of Object.keys(patch)) {
    const prev = before === null ? undefined : beforeRec[field]
    const next = afterRec[field]
    if (!jsonEqual(prev, next)) changes.push({ field, before: prev, after: next })
  }
  return changes
}

/**
 * The single Change Log chokepoint (ADR-022): every entityStore.update appends
 * one entry per changed field here. Failure to log never fails the write — the
 * entity is already persisted, so a lost log line is warned, not thrown.
 */
export async function emitChangeLog<T extends EntityType>(
  type: T,
  id: string,
  patch: Partial<EntityForType<T>>,
  before: EntityForType<T> | null,
  after: EntityForType<T>,
  meta: ChangeMeta
): Promise<void> {
  try {
    const changes = changedFields(patch, before, after)
    if (changes.length === 0) return
    const ts = Date.now()
    const { kind, source } = meta
    const rows = changes.map((c) => ({
      entityType: type,
      entityId: id,
      ts,
      kind,
      field: c.field,
      before: c.before,
      after: c.after,
      source,
    }))
    await db.changeLog.append(rows)

    // Mirror to the server of record (ADR-034 P4b). Until this existed the log
    // was TWO disconnected spines: this function terminated at IndexedDB, while
    // the Convex table was written only by `ownership`, `proposals` and
    // `botClient` — so each drawer showed half the history, and clearing site
    // data destroyed the client half outright.
    //
    // `gameId` comes from the entity's own container, so a row logged against a
    // build inside a Game is filed with that Game and the crew can see it.
    // A soft link has no container of its own — it is addressed by its
    // endpoints, and `ContainerFields` does not apply to it — so it files
    // against the shelf. For everything else `containerOf` is a discriminated
    // union whose shelf arm carries no gameId, which is exactly the `null` the
    // server column expects.
    const gameId =
      type === 'softLink'
        ? null
        : (() => {
            const container = containerOf(after as Parameters<typeof containerOf>[0])
            return container.kind === 'game' ? container.gameId : null
          })()
    void commitChangeLog(rows.map((r) => ({ ...r, gameId }))).catch((err: unknown) => {
      // Not fatal, and deliberately so: this is provenance ABOUT a write that
      // has already landed and already committed. Failing the user's edit
      // because its audit row did not arrive would trade the write for the
      // record of it.
      captureException(err)
    })
  } catch (err) {
    console.warn('[itun-store] change-log append failed', err)
  }
}
