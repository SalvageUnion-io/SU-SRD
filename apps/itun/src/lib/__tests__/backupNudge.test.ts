/**
 * backupNudge tests (plan 2.6, gap 17) — write-count threshold, staleness
 * window, export reset, and the toast-ready subscription.
 *
 * happy-dom provides localStorage via the bunfig preload.
 */
import { beforeEach, describe, expect, test } from 'bun:test'

import {
  BACKUP_NUDGE_STALE_MS,
  BACKUP_NUDGE_WRITE_THRESHOLD,
  getBackupNudgeState,
  recordDataWrite,
  recordExport,
  subscribeBackupNudge,
} from '../backupNudge'

beforeEach(() => {
  localStorage.clear()
})

describe('getBackupNudgeState', () => {
  test('fresh state: not due, zero writes, never exported', () => {
    const state = getBackupNudgeState()
    expect(state.due).toBe(false)
    expect(state.dirtyWrites).toBe(0)
    expect(state.lastExportAt).toBeNull()
  })

  test('becomes due at the write threshold', () => {
    for (let i = 0; i < BACKUP_NUDGE_WRITE_THRESHOLD - 1; i++) {
      recordDataWrite()
    }
    expect(getBackupNudgeState().due).toBe(false)
    recordDataWrite()
    expect(getBackupNudgeState().due).toBe(true)
    expect(getBackupNudgeState().dirtyWrites).toBe(BACKUP_NUDGE_WRITE_THRESHOLD)
  })

  test('becomes due when un-exported writes go stale', () => {
    const past = new Date(Date.now() - BACKUP_NUDGE_STALE_MS - 1000)
    recordDataWrite(past)
    expect(getBackupNudgeState().due).toBe(true)
  })

  test('a single recent write is not due', () => {
    recordDataWrite()
    expect(getBackupNudgeState().due).toBe(false)
  })
})

describe('recordExport', () => {
  test('resets the dirty-write clock', () => {
    for (let i = 0; i < BACKUP_NUDGE_WRITE_THRESHOLD; i++) {
      recordDataWrite()
    }
    expect(getBackupNudgeState().due).toBe(true)

    recordExport()
    const state = getBackupNudgeState()
    expect(state.due).toBe(false)
    expect(state.dirtyWrites).toBe(0)
    expect(state.lastExportAt).not.toBeNull()
  })
})

describe('subscribeBackupNudge', () => {
  test('fires the callback when a write lands while due; unsubscribe stops it', () => {
    const seen: number[] = []
    const unsubscribe = subscribeBackupNudge((state) => {
      seen.push(state.dirtyWrites)
    })

    for (let i = 0; i < BACKUP_NUDGE_WRITE_THRESHOLD - 1; i++) {
      recordDataWrite()
    }
    expect(seen).toHaveLength(0)

    recordDataWrite() // crosses the threshold
    expect(seen).toEqual([BACKUP_NUDGE_WRITE_THRESHOLD])

    unsubscribe()
    recordDataWrite()
    expect(seen).toHaveLength(1)
  })
})
