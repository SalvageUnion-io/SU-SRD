/**
 * ExportAllButton — triggers a full backup download (all pilots, mechs,
 * crawlers, and softLinks) as a single JSON file.
 *
 * Uses buildExportBundle + downloadJson from lib/export.
 * Success/failure surface as toasts; errors also render inline so the
 * failure stays visible next to the retry affordance.
 */

import { Button, toast, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { buildExportBundle } from '../../lib/export/buildExportBundle'
import { downloadJson } from '../../lib/export/downloadJson'
import { useEntityStore } from '../../stores/entityStore'

/** The inline failure line on the ink band (Shelves): paper, not muted ink. */
const ON_INK = { color: tokens.color.paper } satisfies CSSProperties

type ExportAllButtonProps = {
  /** Extra classes for the button (the Shelves band's on-ink outline). */
  className?: string
  /** It sits on the ink band (Shelves, board S1): its failure line reads in paper. */
  onInk?: boolean
}

export function ExportAllButton({ className, onInk = false }: ExportAllButtonProps = {}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExportAll() {
    setBusy(true)
    setError(null)
    try {
      const bundle = await buildExportBundle(useEntityStore.getState())
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(`itun-backup-${date}.json`, bundle)
      toast.success('Backup downloaded.')
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
      <Button
        size="compact"
        disabled={busy}
        onClick={() => void handleExportAll()}
        className={className}
      >
        {busy ? 'Exporting…' : 'Export all'}
      </Button>
      {error && (
        <p className="font-body text-xs text-status-bad" style={onInk ? ON_INK : undefined}>
          {error}
        </p>
      )}
    </div>
  )
}
