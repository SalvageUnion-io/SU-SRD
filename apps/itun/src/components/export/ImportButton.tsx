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

import { Button, FieldError, toast, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { useRef, useState } from 'react'
import type { MergeSummary } from '../../lib/export/mergeImport'
import { mergeImport } from '../../lib/export/mergeImport'
import { parseImportBundle } from '../../lib/export/parseImportBundle'
import { useEntityStore } from '../../stores/entityStore'

/** The inline summary on the ink band (Shelves): paper, not muted ink. */
const ON_INK = { color: tokens.color.paper } satisfies CSSProperties

/** The line an import leaves behind: what came in, and what was skipped. */
function summaryText(summary: MergeSummary): string {
  return `Imported: ${summary.created.pilots} pilot(s), ${summary.created.mechs} mech(s), ${summary.created.crawlers} crawler(s), ${summary.created.softLinks} link(s).${
    summary.skippedDuplicates > 0 ? ` Skipped ${summary.skippedDuplicates} duplicate(s).` : ''
  }`
}

type ImportButtonProps = {
  /** Extra classes for the button (the Shelves band's on-ink outline). */
  className?: string
  /** It sits on the ink band (Shelves, board S1): its summary reads in paper. */
  onInk?: boolean
  /**
   * Where the result goes. Given, the button reports its result line (or null
   * to clear it) to the caller and renders none of its own, so the caller can
   * set it on a line of its own instead of inside the button's flex item.
   */
  onResult?: (message: string | null) => void
}

export function ImportButton({ className, onInk = false, onResult }: ImportButtonProps = {}) {
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
    onResult?.(null)

    try {
      const text = await file.text()
      const bundle = parseImportBundle(text)
      const entityStore = useEntityStore.getState()
      const result = await mergeImport(bundle, entityStore)
      setSummary(result)
      onResult?.(summaryText(result))
      const total = result.created.pilots + result.created.mechs + result.created.crawlers
      toast.success(`Import complete — ${total} entit${total === 1 ? 'y' : 'ies'} created.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed.'
      setError(message)
      onResult?.(message)
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
      <Button size="compact" disabled={busy} onClick={handleClick} className={className}>
        {busy ? 'Importing…' : 'Import'}
      </Button>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => void handleFileChange(e)}
      />
      {!onResult && <FieldError>{error}</FieldError>}
      {!onResult && summary && !error && (
        <p className="font-body text-xs text-wk-muted" style={onInk ? ON_INK : undefined}>
          {summaryText(summary)}
        </p>
      )}
    </div>
  )
}
