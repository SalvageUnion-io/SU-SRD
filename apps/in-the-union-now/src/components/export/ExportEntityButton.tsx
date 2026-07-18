/**
 * ExportEntityButton — exports a single entity (pilot/mech/crawler) plus its
 * directly-attached softLinks as a JSON file.
 *
 * Uses buildEntityExport + downloadJson from lib/export.
 */

import { useState } from 'react'
import { Button, toast } from 'component-lib'

import { buildEntityExport } from '../../lib/export/buildExportBundle'
import { downloadJson } from '../../lib/export/downloadJson'
import { useEntityStore } from '../../stores/entityStore'

type ExportEntityButtonProps = {
  type: 'pilot' | 'mech' | 'crawler'
  id: string
  /** Display name for the file stem (e.g. pilot.name). */
  name: string
}

export function ExportEntityButton({ type, id, name }: ExportEntityButtonProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    setBusy(true)
    setError(null)
    try {
      const entityStore = useEntityStore.getState()
      const bundle = await buildEntityExport(type, id, entityStore)
      // Sanitise the name for use as a filename.
      const safeName = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40)
      downloadJson(`itun-${type}-${safeName}.json`, bundle)
      toast.success(`Exported ${name}.`)
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
      <Button size="sm" disabled={busy} onClick={() => void handleExport()} className="min-h-11">
        {busy ? 'Exporting…' : 'Export'}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}
