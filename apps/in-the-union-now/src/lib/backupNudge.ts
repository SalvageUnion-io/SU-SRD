/**
 * Backup nudge (plan 2.6, gap 17).
 *
 * ITUN data lives in one browser's IndexedDB; export is the only escape
 * hatch, and nothing used to prompt the user to use it. This module tracks
 * un-backed-up writes (and time since the last full export) in localStorage
 * and exposes a toast-ready subscription: UI surfaces register a callback and
 * show whatever affordance they like when the nudge comes due.
 *
 * Wiring (this phase): entityStore/workspaceStore writes call
 * recordDataWrite(); buildExportBundle() calls recordExport(). UI surfacing
 * lands with the dashboard/sheet rebuild phases.
 */

export type BackupNudgeState = {
  /** True when the user should be nudged to export a backup. */
  due: boolean
  /** Writes since the last full export (persisted across reloads). */
  dirtyWrites: number
  /** ISO timestamp of the last full export, or null if never exported. */
  lastExportAt: string | null
}

export type BackupNudgeListener = (state: BackupNudgeState) => void

/** Nudge after this many writes since the last full export… */
export const BACKUP_NUDGE_WRITE_THRESHOLD = 25
/** …or when there are ANY un-exported writes older than this. */
export const BACKUP_NUDGE_STALE_MS = 7 * 24 * 60 * 60 * 1000

const DIRTY_WRITES_KEY = 'itun-backup:dirtyWrites'
const LAST_EXPORT_KEY = 'itun-backup:lastExportAt'
const FIRST_DIRTY_WRITE_KEY = 'itun-backup:firstDirtyWriteAt'

const listeners = new Set<BackupNudgeListener>()

function storageAvailable(): boolean {
  return typeof localStorage !== 'undefined'
}

function readInt(key: string): number {
  if (!storageAvailable()) return 0
  const raw = localStorage.getItem(key)
  const n = raw === null ? NaN : Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function readString(key: string): string | null {
  if (!storageAvailable()) return null
  return localStorage.getItem(key)
}

export function getBackupNudgeState(now: Date = new Date()): BackupNudgeState {
  const dirtyWrites = readInt(DIRTY_WRITES_KEY)
  const lastExportAt = readString(LAST_EXPORT_KEY)
  const firstDirtyWriteAt = readString(FIRST_DIRTY_WRITE_KEY)

  const overWriteThreshold = dirtyWrites >= BACKUP_NUDGE_WRITE_THRESHOLD
  const stale =
    dirtyWrites > 0 &&
    firstDirtyWriteAt !== null &&
    now.getTime() - new Date(firstDirtyWriteAt).getTime() >= BACKUP_NUDGE_STALE_MS

  return { due: overWriteThreshold || stale, dirtyWrites, lastExportAt }
}

function notifyIfDue(): void {
  const state = getBackupNudgeState()
  if (!state.due) return
  for (const listener of listeners) {
    try {
      listener(state)
    } catch (err) {
      console.error('[itun-backup] nudge listener threw', err)
    }
  }
}

/** Record one persisted data mutation (create/update/delete). */
export function recordDataWrite(now: Date = new Date()): void {
  if (!storageAvailable()) return
  const next = readInt(DIRTY_WRITES_KEY) + 1
  try {
    localStorage.setItem(DIRTY_WRITES_KEY, String(next))
    if (localStorage.getItem(FIRST_DIRTY_WRITE_KEY) === null) {
      localStorage.setItem(FIRST_DIRTY_WRITE_KEY, now.toISOString())
    }
  } catch {
    return // storage full/unavailable — nudging degrades gracefully
  }
  notifyIfDue()
}

/** Record a completed FULL export — resets the dirty-write clock. */
export function recordExport(now: Date = new Date()): void {
  if (!storageAvailable()) return
  try {
    localStorage.setItem(LAST_EXPORT_KEY, now.toISOString())
    localStorage.setItem(DIRTY_WRITES_KEY, '0')
    localStorage.removeItem(FIRST_DIRTY_WRITE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Register a toast-ready callback fired (with the current state) whenever a
 * write lands while the nudge is due. Returns an unsubscribe function.
 */
export function subscribeBackupNudge(listener: BackupNudgeListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
