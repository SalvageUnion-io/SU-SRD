/**
 * LinkQr — renders a share URL as a scannable QR code: a public sheet's `/p/:kind/:appId`.
 *
 * SVG output (not canvas): deterministic under happy-dom tests and crisp at
 * any DPI. The tile is forced white with an encoder quiet zone — QR readers
 * need dark-on-light regardless of app theme.
 *
 * Lives in the Cantina, not component-lib: The Cantina is its only renderer, and keeping it
 * in the library meant the library's manifest declared `qrcode` for one app's
 * sake. Covered by `__tests__/ShareStatusDialog.connected.test.tsx`.
 */

import { tokens } from 'component-lib'
import QRCode from 'qrcode'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'

type LinkQrProps = {
  /** Absolute URL to encode. */
  url: string
}

/** The 84px ink-framed paper tile, shared by the placeholder and the code. */
const TILE = {
  height: '84px',
  width: '84px',
  flexShrink: 0,
  borderRadius: tokens.radius.card,
  border: `${tokens.borderWidth.chrome} solid ${tokens.color.ink}`,
  backgroundColor: tokens.color.paper,
} satisfies CSSProperties

/** The encoder's SVG fills the tile (`.su-sheet-qr > svg`). */
const CODE = { ...TILE, padding: tokens.space[4] } satisfies CSSProperties

export function LinkQr({ url }: LinkQrProps) {
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then((markup) => {
        if (!cancelled) setSvg(markup)
      })
      .catch((err: unknown) => {
        // Encoding a URL cannot realistically fail; degrade to no tile.
        console.error('[cantina] QR generation failed.', err)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (svg === null) {
    return <div aria-hidden="true" className="su-pulse" style={TILE} />
  }

  return (
    <div
      role="img"
      aria-label="QR code linking to this sheet"
      data-testid="share-qr"
      className="su-sheet-qr"
      style={CODE}
      // Trusted markup: generated locally by the qrcode encoder from module
      // geometry — the URL is encoded as QR modules, never interpolated as HTML.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG string is produced locally by the qrcode encoder from module geometry; no user-controlled HTML can reach it
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
