/**
 * ExportEntityButton — exports a single entity (pilot/mech/crawler) plus its
 * directly-attached softLinks as a JSON file.
 *
 * Uses buildEntityExport + downloadJson from lib/export.
 */

import { Button, toast } from 'component-lib'
import { color, fontSize, space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { buildEntityExport } from '../../lib/export/buildExportBundle'
import { downloadJson } from '../../lib/export/downloadJson'
import { useEntityStore } from '../../stores/entityStore'

const STACK = { display: 'flex', flexDirection: 'column', gap: space[4] } satisfies CSSProperties

/** The 44px touch target. */
const BUTTON = { minHeight: '2.75rem' } satisfies CSSProperties

const FAILURE = {
  color: color.statusBad,
  fontSize: fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
} satisfies CSSProperties

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
    <div style={STACK}>
      <Button size="compact" disabled={busy} onClick={() => void handleExport()} style={BUTTON}>
        {busy ? 'Exporting…' : 'Export'}
      </Button>
      {error && <p style={FAILURE}>{error}</p>}
    </div>
  )
}
