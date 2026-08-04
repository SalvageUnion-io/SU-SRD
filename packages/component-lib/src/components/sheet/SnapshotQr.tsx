/**
 * SnapshotQr — renders the published snapshot URL as a scannable QR code
 * (issues #227/#259, audit item 14; replaces the §3.4 checker placeholder).
 *
 * SVG output (not canvas): deterministic under happy-dom tests and crisp at
 * any DPI. The tile is forced white with an encoder quiet zone — QR readers
 * need dark-on-light regardless of app theme.
 */

import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

type SnapshotQrProps = {
  /** Absolute share URL (e.g. https://…/s/<id>). */
  url: string
}

export function SnapshotQr({ url }: SnapshotQrProps) {
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then((markup) => {
        if (!cancelled) setSvg(markup)
      })
      .catch((err: unknown) => {
        // Encoding a URL cannot realistically fail; degrade to no tile.
        console.error('[itun] QR generation failed.', err)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (svg === null) {
    return (
      <div
        aria-hidden="true"
        className="h-[84px] w-[84px] shrink-0 animate-pulse rounded-card border-chrome border-ink bg-paper"
      />
    )
  }

  return (
    <div
      role="img"
      aria-label="QR code linking to this snapshot"
      data-testid="snapshot-qr"
      className="h-[84px] w-[84px] shrink-0 rounded-card border-chrome border-ink bg-paper p-1 [&>svg]:h-full [&>svg]:w-full"
      // Trusted markup: generated locally by the qrcode encoder from module
      // geometry — the URL is encoded as QR modules, never interpolated as HTML.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG string is produced locally by the qrcode encoder from module geometry; no user-controlled HTML can reach it
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
