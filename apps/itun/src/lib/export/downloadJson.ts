/**
 * downloadJson — trigger a browser file download for a JSON payload.
 *
 * Guards for non-browser environments (SSR, tests) by checking for the
 * presence of `document`. In those environments the function is a no-op.
 *
 * @param filename - The suggested filename (e.g. "itun-backup-2026-01-01.json")
 * @param data     - Any JSON-serialisable value. Pretty-printed with 2-space indent.
 */
export function downloadJson(filename: string, data: unknown): void {
  if (typeof document === 'undefined') return

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)

  // Revoke after a short delay so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
