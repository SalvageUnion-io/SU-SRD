/**
 * BackupNudgeToast — toast surfacing for lib/backupNudge (plan 2.6/5.4, gap 17).
 *
 * Renders nothing; on mount it checks the persisted nudge state (so a stale
 * backlog surfaces on app load, not only on the next write) and subscribes to
 * write-time nudges. The stable toast id dedupes repeat fires into a single
 * updating toast instead of stacking one per write.
 */

import { toast } from 'component-lib'
import { useEffect } from 'react'
import type { BackupNudgeState } from '../../lib/backupNudge'
import { getBackupNudgeState, subscribeBackupNudge } from '../../lib/backupNudge'

const BACKUP_NUDGE_TOAST_ID = 'backup-nudge'

function showNudge(state: BackupNudgeState) {
  const since = state.lastExportAt
    ? `since your last backup (${state.lastExportAt.slice(0, 10)})`
    : 'and no backup yet'
  toast.info(`${state.dirtyWrites} change(s) ${since} — use "Download all" on the dashboard.`, {
    id: BACKUP_NUDGE_TOAST_ID,
    duration: 8000,
  })
}

export function BackupNudgeToast() {
  useEffect(() => {
    const state = getBackupNudgeState()
    if (state.due) showNudge(state)
    return subscribeBackupNudge(showNudge)
  }, [])

  return null
}
