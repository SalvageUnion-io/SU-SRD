/**
 * ExportAllButton — triggers a full backup download (all pilots, mechs,
 * crawlers, and softLinks) as a single JSON file.
 *
 * Uses buildExportBundle + downloadJson from lib/export.
 * Success/failure surface as toasts; errors also render inline so the
 * failure stays visible next to the retry affordance.
 */

import { Button, toast } from 'component-lib'
import { color, font, fontSize, space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { useServerAction } from '../../lib/connection/useServerAction'
import { buildExportBundle } from '../../lib/export/buildExportBundle'
import { downloadJson } from '../../lib/export/downloadJson'
import { useEntityStore } from '../../stores/entityStore'

const STACK = { display: 'flex', flexDirection: 'column', gap: space[4] } satisfies CSSProperties

/** The inline failure line. */
const FAILURE = {
  color: color.statusBad,
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
} satisfies CSSProperties

/** The same line on the ink band (Shelves): paper, not the danger colour. */
const FAILURE_ON_INK = { ...FAILURE, color: color.paper } satisfies CSSProperties

type ExportAllButtonProps = {
  /** Extra classes for the button (the Shelves band's on-ink outline). */
  className?: string
  /** It sits on the ink band (Shelves, board S1): its failure line reads in paper. */
  onInk?: boolean
}

export function ExportAllButton({ className, onInk = false }: ExportAllButtonProps = {}) {
  const exportAll = useServerAction(
    async () => {
      const bundle = await buildExportBundle(useEntityStore.getState())
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(`itun-backup-${date}.json`, bundle)
    },
    { failure: 'The backup could not be downloaded. Try again.' }
  )
  const { pending: busy, error } = exportAll

  async function handleExportAll() {
    const result = await exportAll.run()
    if (result.ok) toast.success('Backup downloaded.')
    else toast.error(result.error)
  }

  return (
    <div style={STACK}>
      <Button
        size="compact"
        disabled={busy}
        onClick={() => void handleExportAll()}
        className={className}
      >
        {busy ? 'Exporting…' : 'Export all'}
      </Button>
      {error && <p style={onInk ? FAILURE_ON_INK : FAILURE}>{error}</p>}
    </div>
  )
}
