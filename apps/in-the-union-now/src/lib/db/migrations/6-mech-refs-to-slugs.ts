/**
 * v6 — normalize mech + mechPattern reference fields from display NAMES to
 * SLUGS (audit sweep item 1).
 *
 * The builder historically wrote `chassisRef`/`systems[]`/`modules[]` as
 * entity names (e.g. "Ghost Chassis"), so any rename in the reference dataset
 * silently orphaned stored mechs. Slugs are the repo-wide convention (pilot
 * `classRef`, encounter `refSlug`, entity links) and are derived mechanically
 * from names via `nameToSlug`, so this rewrite needs no reference data:
 * `nameToSlug` is pure, synchronous, and idempotent (a slug slugifies to
 * itself), which also makes the migration safe to re-run.
 *
 * The per-item maps keyed by those refs (`systemConditions`,
 * `moduleConditions`, `itemUses`) are re-keyed the same way. Two map entries
 * can only collide if their names already slugified identically, in which
 * case they referred to the same item — later entries win, matching object
 * spread semantics used by the sheet writes.
 *
 * Refs that never resolved (custom/stale names) are still slugified: the
 * read path (lib/rules/resolveRefs.ts) tolerates slug OR name OR id, so
 * nothing that resolved before stops resolving now.
 *
 * IMPORTANT: this function runs inside the versionchange transaction. Only
 * IndexedDB operations on `tx` may be awaited — `nameToSlug` is synchronous,
 * so the transaction stays open for the duration of the rewrite.
 */

import { nameToSlug } from 'salvageunion-reference'

import type { UpgradeTransaction } from './index'
import { STORE_NAMES } from '../stores'

/** Slugify one ref; leaves empty strings untouched. */
function slugifyRef(ref: unknown): unknown {
  return typeof ref === 'string' && ref !== '' ? nameToSlug(ref) : ref
}

/** Re-key a ref-keyed record map with slugified keys (later entries win). */
function slugifyKeys(map: unknown): unknown {
  if (typeof map !== 'object' || map === null || Array.isArray(map)) return map
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
    out[typeof key === 'string' && key !== '' ? nameToSlug(key) : key] = value
  }
  return out
}

/** Rewrite one mech/mechPattern record in place; returns null when unchanged. */
export function normalizeRefsRecord(raw: Record<string, unknown>): Record<string, unknown> | null {
  const next: Record<string, unknown> = { ...raw }
  let changed = false

  if (typeof raw['chassisRef'] === 'string') {
    const slug = slugifyRef(raw['chassisRef'])
    if (slug !== raw['chassisRef']) {
      next['chassisRef'] = slug
      changed = true
    }
  }

  for (const field of ['systems', 'modules'] as const) {
    const value = raw[field]
    if (Array.isArray(value)) {
      const mapped = value.map(slugifyRef)
      if (mapped.some((ref, i) => ref !== value[i])) {
        next[field] = mapped
        changed = true
      }
    }
  }

  for (const field of ['systemConditions', 'moduleConditions', 'itemUses'] as const) {
    const value = raw[field]
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const rekeyed = slugifyKeys(value) as Record<string, unknown>
      if (Object.keys(rekeyed).some((key) => !(key in (value as Record<string, unknown>)))) {
        next[field] = rekeyed
        changed = true
      }
    }
  }

  return changed ? next : null
}

export async function migrate(tx: UpgradeTransaction): Promise<void> {
  for (const storeName of [STORE_NAMES.mechs, STORE_NAMES.mechPatterns]) {
    if (!tx.db.objectStoreNames.contains(storeName)) continue
    let cursor = await tx.objectStore(storeName).openCursor()
    while (cursor) {
      const raw = cursor.value as unknown
      if (typeof raw === 'object' && raw !== null) {
        const next = normalizeRefsRecord(raw as Record<string, unknown>)
        if (next) await cursor.update(next)
      }
      cursor = await cursor.continue()
    }
  }
}
