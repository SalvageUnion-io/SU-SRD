/**
 * ExportAllButton — triggers a full backup download (all pilots, mechs,
 * crawlers, workspaces, and softLinks) as a single JSON file.
 *
 * Uses buildExportBundle + downloadJson from lib/export.
 * Renders inline error text on failure rather than a toast.
 */

import { useState } from 'react'

import { buildExportBundle } from '../../lib/export/buildExportBundle'
import { downloadJson } from '../../lib/export/downloadJson'
import { useEntityStore } from '../../stores/entityStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { Button } from '../ui/button'

export function ExportAllButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExportAll() {
    setBusy(true)
    setError(null)
    try {
      const entityStore = useEntityStore.getState()
      const workspaceStore = useWorkspaceStore.getState()
      const bundle = await buildExportBundle(entityStore, workspaceStore)
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(`itun-backup-${date}.json`, bundle)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void handleExportAll()}
        className="min-h-[44px]"
      >
        {busy ? 'Exporting…' : 'Download all'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
