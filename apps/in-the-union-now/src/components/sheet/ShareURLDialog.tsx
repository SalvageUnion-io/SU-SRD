/**
 * ShareURLDialog — modal that displays a snapshot share URL with
 * copy-to-clipboard support.
 *
 * Pattern: same lightweight role="dialog" pattern used by DeleteConfirmDialog —
 * no ShadCN Dialog dependency, Escape-to-dismiss via backdrop keyDown.
 *
 * Props are dep-injectable so tests can supply a mock clipboard writer
 * without mock.module().
 */

import { useRef, useState } from 'react'

import { useDialogA11y } from '../shared/useDialogA11y'
import { Button } from '../ui/button'

type ShareURLDialogProps = {
  /** Full URL to display and copy (e.g. "https://example.com/s/abc123") */
  url: string
  /** Called when the dialog is dismissed */
  onClose: () => void
  /**
   * Injectable clipboard writer for testing.
   * Defaults to navigator.clipboard.writeText.
   */
  clipboardWriter?: (text: string) => Promise<void>
  /**
   * Injectable toast callback for testing.
   * Defaults to a no-op (in production, a toast would be shown separately).
   */
  onCopied?: () => void
}

export function ShareURLDialog({
  url,
  onClose,
  clipboardWriter = (text) => navigator.clipboard.writeText(text),
  onCopied,
}: ShareURLDialogProps) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogA11y({ ref: dialogRef, onClose })

  async function handleCopy() {
    setCopyError(null)
    try {
      await clipboardWriter(url)
      setCopied(true)
      onCopied?.()
      // Reset the "Copied!" label after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError('Failed to copy URL. Please copy it manually.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        className="w-full max-w-md rounded-[6px] border border-[var(--color-su-black)] bg-[var(--color-su-white)] p-6 shadow-xl"
      >
        <h2 id="share-dialog-title" className="mb-4 text-lg font-semibold">
          Share Snapshot
        </h2>

        <p className="mb-2 text-sm text-muted-foreground">
          Anyone with this link can view a read-only snapshot of this sheet.
        </p>

        {/* URL display */}
        <div className="mb-4 flex items-center gap-2 rounded-[3px] border border-[var(--color-su-grey-light)] bg-[var(--color-su-blue-pale)] px-3 py-2">
          <span className="flex-1 truncate font-mono text-sm" aria-label="Share URL">
            {url}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCopy()}
            aria-label="Copy share URL"
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>

        {copyError && (
          <p role="alert" className="mb-4 text-sm text-[var(--color-su-rust)]">
            {copyError}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
