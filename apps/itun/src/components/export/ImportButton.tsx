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

import { Button, FieldError, toast } from 'component-lib'
import { color, font, fontSize, space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { useRef, useState } from 'react'
import { useServerAction } from '../../lib/connection/useServerAction'
import type { MergeSummary } from '../../lib/export/mergeImport'
import { mergeImport } from '../../lib/export/mergeImport'
import { ImportRefused, parseImportBundle } from '../../lib/export/parseImportBundle'
import { useEntityStore } from '../../stores/entityStore'

const STACK = { display: 'flex', flexDirection: 'column', gap: space[4] } satisfies CSSProperties

/** The inline summary line. */
const SUMMARY = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
} satisfies CSSProperties

/** The same line on the ink band (Shelves): paper, not muted ink. */
const SUMMARY_ON_INK = { ...SUMMARY, color: color.paper } satisfies CSSProperties

/** The line an import leaves behind: what came in, and what was skipped. */
function summaryText(summary: MergeSummary): string {
  return `Imported: ${summary.created.pilots} pilot(s), ${summary.created.mechs} mech(s), ${summary.created.crawlers} crawler(s), ${summary.created.softLinks} link(s).${
    summary.skippedDuplicates > 0 ? ` Skipped ${summary.skippedDuplicates} duplicate(s).` : ''
  }`
}

const IMPORT_PLAYER_ERRORS = [ImportRefused]

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
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<MergeSummary | null>(null)

  const importFile = useServerAction(
    async (file: File) =>
      mergeImport(parseImportBundle(await file.text()), useEntityStore.getState()),
    {
      failure: 'That backup could not be imported. Try again.',
      // A file that is not a backup is the player's to fix, and its reason is
      // written for them.
      playerErrors: IMPORT_PLAYER_ERRORS,
    }
  )
  const busy = importFile.pending

  function refuse(message: string) {
    setError(message)
    onResult?.(message)
    toast.error(message)
  }

  function handleClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setSummary(null)
    onResult?.(null)

    const result = await importFile.run(file)
    // Reset input so the same file can be re-selected.
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    if (!result.ok) return refuse(result.error)

    const merged = result.value
    setSummary(merged)
    onResult?.(summaryText(merged))
    const total = merged.created.pilots + merged.created.mechs + merged.created.crawlers
    toast.success(`Import complete — ${total} entit${total === 1 ? 'y' : 'ies'} created.`)
  }

  return (
    <div style={STACK}>
      <Button size="compact" disabled={busy} onClick={handleClick} className={className}>
        {busy ? 'Importing…' : 'Import'}
      </Button>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="su-sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => void handleFileChange(e)}
      />
      {!onResult && <FieldError>{error}</FieldError>}
      {!onResult && summary && !error && (
        <p style={onInk ? SUMMARY_ON_INK : SUMMARY}>{summaryText(summary)}</p>
      )}
    </div>
  )
}
