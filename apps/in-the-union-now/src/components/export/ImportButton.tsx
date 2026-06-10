/**
 * ImportButton — file input that reads a JSON export bundle and merges it
 * into the local store.
 *
 * Flow:
 *   1. User clicks "Import…" → hidden <input type="file"> is triggered.
 *   2. File is read as text → parseImportBundle validates it.
 *   3. mergeImport assigns fresh ids and creates entities in the store.
 *   4. A summary is shown inline; errors show inline error text.
 *
 * The input resets after each operation so the same file can be re-imported
 * if the user needs to retry after a partial failure.
 */

import { useRef, useState } from 'react'
import { Btn, toast } from 'suref-react'

import { mergeImport } from '../../lib/export/mergeImport'
import { parseImportBundle } from '../../lib/export/parseImportBundle'
import type { MergeSummary } from '../../lib/export/mergeImport'
import { useEntityStore } from '../../stores/entityStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'

export function ImportButton() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<MergeSummary | null>(null)

  function handleClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setBusy(true)
    setError(null)
    setSummary(null)

    try {
      const text = await file.text()
      const bundle = parseImportBundle(text)
      const entityStore = useEntityStore.getState()
      const workspaceStore = useWorkspaceStore.getState()
      const result = await mergeImport(bundle, entityStore, workspaceStore)
      setSummary(result)
      const total =
        result.created.pilots +
        result.created.mechs +
        result.created.crawlers +
        result.created.workspaces
      toast.success(`Import complete — ${total} entit${total === 1 ? 'y' : 'ies'} created.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed.'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
      // Reset input so the same file can be re-selected.
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Btn size="sm" disabled={busy} onClick={handleClick}>
        {busy ? 'Importing…' : 'Import…'}
      </Btn>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        aria-hidden="true"
        onChange={(e) => void handleFileChange(e)}
      />
      {error && <p className="font-body text-xs text-danger">{error}</p>}
      {summary && !error && (
        <p className="font-body text-xs text-wk-muted">
          Imported: {summary.created.pilots} pilot(s), {summary.created.mechs} mech(s),{' '}
          {summary.created.crawlers} crawler(s), {summary.created.softLinks} link(s),{' '}
          {summary.created.workspaces} workspace(s).
          {summary.skippedDuplicates > 0 && ` Skipped ${summary.skippedDuplicates} duplicate(s).`}
        </p>
      )}
    </div>
  )
}
