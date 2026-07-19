/**
 * publishedSnapshots — local record of the snapshots this browser has shared.
 *
 * Shared snapshots live forever server-side (no TTL), and the app is
 * local-first with no auth, so the snapshot id IS the capability to revoke it.
 * We keep the ids the user has published in localStorage (the backupNudge
 * pattern) so the Share screen can show — and revoke — their own shared links.
 *
 * This is not a source of truth for what exists server-side; it's a convenience
 * ledger. A cleared browser simply forgets its links (the snapshots persist),
 * and a failed revoke leaves the record so the user can retry.
 */

import type { EntityRef } from '../schemas/entity'

export type PublishedSnapshot = {
  /** Snapshot id (the /s/:id capability). */
  id: string
  /** Source entity kind + id, so the Share screen can list this build's links. */
  kind: EntityRef['type']
  entityId: string
  /** Entity name at publish time — for a human-readable list. */
  name: string
  /** ISO timestamp of publication. */
  publishedAt: string
}

const STORAGE_KEY = 'itun-snapshots:published'

function storageAvailable(): boolean {
  return typeof localStorage !== 'undefined'
}

function readAll(): PublishedSnapshot[] {
  if (!storageAvailable()) return []
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Tolerant filter — drop any malformed rows rather than throwing.
    return parsed.filter(
      (row): row is PublishedSnapshot =>
        typeof row === 'object' &&
        row !== null &&
        typeof (row as PublishedSnapshot).id === 'string' &&
        typeof (row as PublishedSnapshot).entityId === 'string'
    )
  } catch {
    return []
  }
}

function writeAll(rows: PublishedSnapshot[]): void {
  if (!storageAvailable()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch {
    // storage full/unavailable — the ledger degrades gracefully.
  }
}

/** All snapshots this browser has published, newest first. */
export function listPublishedSnapshots(): PublishedSnapshot[] {
  return readAll().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

/** Snapshots published from one specific entity (Share-screen view), newest first. */
export function listPublishedSnapshotsFor(
  kind: EntityRef['type'],
  entityId: string
): PublishedSnapshot[] {
  return listPublishedSnapshots().filter((s) => s.kind === kind && s.entityId === entityId)
}

/** Record a freshly published snapshot (de-duped by id). */
export function recordPublishedSnapshot(entry: PublishedSnapshot): void {
  const rows = readAll().filter((s) => s.id !== entry.id)
  rows.push(entry)
  writeAll(rows)
}

/** Forget a snapshot's local record (after a successful revoke). */
export function removePublishedSnapshot(id: string): void {
  const rows = readAll().filter((s) => s.id !== id)
  writeAll(rows)
}
