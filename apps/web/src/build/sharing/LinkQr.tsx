/**
 * LinkQr — renders a share URL as a scannable QR code: a public sheet's `/p/:kind/:appId`.
 *
 * SVG output (not canvas): deterministic under happy-dom tests and crisp at
 * any DPI. The tile is the house `Box` (its paper body, ink frame) with an
 * encoder quiet zone — QR readers need dark-on-light regardless of app theme.
 *
 * Lives in the app, not src/components: the app is its only renderer, and keeping it
 * in the library meant the library's manifest declared `qrcode` for one app's
 * sake. Covered by `__tests__/ShareStatusDialog.connected.test.tsx`.
 */

import QRCode from 'qrcode'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { Box, SkeletonFrame, tokens } from '../../components/index'
import { buildSharingCopy } from '../../messages/build-sharing'

type LinkQrProps = {
  /** Absolute URL to encode. */
  url: string
}

/** The 128px square the tile fills, shared by the placeholder and the code. */
const TILE = {
  height: '128px',
  width: '128px',
  flexShrink: 0,
} satisfies CSSProperties

/** The code's quiet margin inside the Box's frame. */
const CODE_BODY = { padding: tokens.space[4] } satisfies CSSProperties

/** The encoder's SVG fills the body (`.su-sheet-qr > svg`). */
const CODE = { height: '100%' } satisfies CSSProperties

export function LinkQr({ url }: LinkQrProps) {
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) // design-tokens-ignore(raw-spacing): the QR quiet zone in modules, a library option, not CSS
      .then((markup) => {
        if (!cancelled) setSvg(markup)
      })
      .catch((err: unknown) => {
        // Encoding a URL cannot realistically fail; degrade to no tile.
        console.error('[app] QR generation failed.', err)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (svg === null) {
    return (
      <SkeletonFrame label={buildSharingCopy('theQrCode')} style={TILE}>
        <Box fill body="flush" bodyStyle={CODE_BODY} className="su-sheet-qr-tile">
          <div style={CODE} />
        </Box>
      </SkeletonFrame>
    )
  }

  return (
    <div style={TILE}>
      <Box fill body="flush" bodyStyle={CODE_BODY} className="su-sheet-qr-tile">
        <div
          role="img"
          aria-label={buildSharingCopy('qrCodeLinkingToThis')}
          data-testid="share-qr"
          className="su-sheet-qr"
          style={CODE}
          // Trusted markup: generated locally by the qrcode encoder from module
          // geometry — the URL is encoded as QR modules, never interpolated as HTML.
          // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG string is produced locally by the qrcode encoder from module geometry; no user-controlled HTML can reach it
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </Box>
    </div>
  )
}
