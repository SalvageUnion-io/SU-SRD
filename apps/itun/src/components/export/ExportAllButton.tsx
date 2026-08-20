/**
 * ExportAllButton — triggers a full backup download (all pilots, mechs,
 * crawlers, and softLinks) as a single JSON file.
 *
 * Uses buildExportBundle + downloadJson from lib/export.
 * Success/failure surface as toasts; errors also render inline so the
 * failure stays visible next to the retry affordance.
 */

import { Button, toast } from 'component-lib'
import { useState } from 'react'
import { buildExportBundle } from '../../lib/export/buildExportBundle'
import { downloadJson } from '../../lib/export/downloadJson'
import { useEntityStore } from '../../stores/entityStore'

type ExportAllButtonProps = {
  /**
   * Called after a bundle has actually been downloaded.
   *
   * Exists for the claim card, where declining is terminal and may only go
   * quiet once a backup has genuinely been TAKEN — "we offered" is not the same
   * fact as "they have a copy", and treating them as one is how a roster is lost
   * by somebody who meant to deal with it later. `buildExportBundle` already
   * calls `recordExport()`, but that is persisted state with no change
   * notification, so a caller that must re-render needs telling directly.
   */
  onExported?: () => void
}

export function ExportAllButton({ onExported }: ExportAllButtonProps = {}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExportAll() {
    setBusy(true)
    setError(null)
    try {
      const entityStore = useEntityStore.getState()
      const bundle = await buildExportBundle(entityStore)
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(`itun-backup-${date}.json`, bundle)
      toast.success('Backup downloaded.')
      // After the download, not before: a failed build must not count as a
      // backup taken.
      onExported?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed.'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="compact" disabled={busy} onClick={() => void handleExportAll()}>
        {busy ? 'Exporting…' : 'Download all'}
      </Button>
      {error && <p className="font-body text-xs text-status-bad">{error}</p>}
    </div>
  )
}
