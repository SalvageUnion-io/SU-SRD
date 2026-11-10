/**
 * BackupMenu — the Training Bay band's one "⋯": **Import…** (a JSON export
 * bundle, merged into the store under fresh ids) and **Export all** (your own
 * units, `ownUnits`, never a crewmate's the device holds for Play, as one
 * dated backup file). Two rare acts behind one control, so the band's line
 * is the page's name.
 *
 * What either left behind (what an import created and skipped, why a file
 * was refused, a download that failed) goes to the caller's status line
 * (`onResult`; null clears it) and a toast. The file input resets after each
 * import, so the same file can be chosen again after a partial failure.
 */

import { useRef } from 'react'
import { HeaderMenu, toast } from '../../components/index'
import { useMyPerson } from '../../lib/auth/session'
import { useServerAction } from '../../lib/connection/useServerAction'
import { buildExportBundle } from '../../lib/export/buildExportBundle'
import { downloadJson } from '../../lib/export/downloadJson'
import type { MergeSummary } from '../../lib/export/mergeImport'
import { mergeImport } from '../../lib/export/mergeImport'
import { ImportRefused, parseImportBundle } from '../../lib/export/parseImportBundle'
import { buildExportCopy } from '../../messages/build-export'
import { ownUnits, useUnits } from '../../replica/units'

/** The line an import leaves behind: what came in, and what was skipped. */
function summaryText(summary: MergeSummary): string {
  return `Imported: ${summary.created.pilots} pilot(s), ${summary.created.mechs} mech(s), ${summary.created.crawlers} crawler(s), ${summary.created.softLinks} link(s).${
    summary.skippedDuplicates > 0 ? ` Skipped ${summary.skippedDuplicates} duplicate(s).` : ''
  }`
}

const IMPORT_PLAYER_ERRORS = [ImportRefused]

type BackupMenuProps = {
  /** Offer Import: only a session that can write. */
  canImport: boolean
  /** The result line (or null to clear it), for the caller's status line. */
  onResult: (message: string | null) => void
}

export function BackupMenu({ canImport, onResult }: BackupMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const me = useMyPerson()

  const importFile = useServerAction(
    async (file: File) => mergeImport(parseImportBundle(await file.text()), useUnits.getState()),
    {
      failure: buildExportCopy('importFailed'),
      // A file that is not a backup is the player's to fix, and its reason is
      // written for them.
      playerErrors: IMPORT_PLAYER_ERRORS,
    }
  )
  const exportAll = useServerAction(
    async () => {
      const bundle = await buildExportBundle(ownUnits(me))
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(`salvageunion-backup-${date}.json`, bundle)
    },
    { failure: buildExportCopy('backupFailed') }
  )
  const busy = importFile.pending || exportAll.pending

  function refuse(message: string) {
    onResult(message)
    toast.error(message)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onResult(null)
    const result = await importFile.run(file)
    // Reset the input so the same file can be chosen again.
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!result.ok) return refuse(result.error)
    const merged = result.value
    onResult(summaryText(merged))
    const total = merged.created.pilots + merged.created.mechs + merged.created.crawlers
    toast.success(
      buildExportCopy(total === 1 ? 'importCompleteOne' : 'importCompleteMany', { count: total })
    )
  }

  async function handleExportAll() {
    onResult(null)
    const result = await exportAll.run()
    if (result.ok) toast.success(buildExportCopy('backupDownloaded'))
    else refuse(result.error)
  }

  return (
    <>
      <HeaderMenu
        variant="overflow"
        size="compact"
        trigger={null}
        label={buildExportCopy('backups')}
        disabled={busy}
        sections={[
          [
            ...(canImport
              ? [
                  {
                    id: 'import',
                    label: buildExportCopy('import'),
                    onSelect: () => fileInputRef.current?.click(),
                  },
                ]
              : []),
            {
              id: 'export-all',
              label: buildExportCopy('exportAll'),
              onSelect: () => void handleExportAll(),
            },
          ],
        ]}
      />
      {canImport && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="su-sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => void handleFileChange(e)}
        />
      )}
    </>
  )
}
