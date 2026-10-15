/**
 * ExportEntityButton — exports a single entity (pilot/mech/crawler) plus its
 * directly-attached softLinks as a JSON file.
 *
 * Uses buildEntityExport + downloadJson from lib/export.
 */

import type { CSSProperties } from 'react'
import { color, fontSize, space } from '../../../ui/design/tokens'
import { Button, toast } from '../../../ui/index'
import { useServerAction } from '../../lib/connection/useServerAction'
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
  const exportOne = useServerAction(
    async () => {
      const bundle = await buildEntityExport(type, id, useEntityStore.getState())
      // Sanitise the name for use as a filename.
      const safeName = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40)
      downloadJson(`cantina-${type}-${safeName}.json`, bundle)
    },
    { failure: `${name} could not be exported. Try again.` }
  )
  const { pending: busy, error } = exportOne

  async function handleExport() {
    const result = await exportOne.run()
    if (result.ok) toast.success(`Exported ${name}.`)
    else toast.error(result.error)
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
