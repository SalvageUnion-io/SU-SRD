/**
 * LinkQr — renders a share URL as a scannable QR code: a public sheet's `/p/:kind/:appId`.
 *
 * SVG output (not canvas): drawn synchronously from the encoder's module grid,
 * deterministic under happy-dom tests and crisp at any DPI. The tile is the house `Box` (its paper body, ink frame) with an
 * encoder quiet zone — QR readers need dark-on-light regardless of app theme.
 *
 * Lives in the app, not src/components: the app is its only renderer, and keeping it
 * in the library meant the library's manifest declared `qrcode` for one app's
 * sake. The encoder is `LinkQrCode`'s, fetched when the tile first renders: a
 * sheet does not carry it until its Share dialog shows a link. Covered by `__tests__/ShareStatusDialog.connected.test.tsx`.
 */

import type { CSSProperties } from 'react'
import { lazy, Suspense } from 'react'
import { Box, tokens } from '../../components/index'

const LinkQrCode = lazy(() => import('./LinkQrCode').then((m) => ({ default: m.LinkQrCode })))

type LinkQrProps = {
  /** Absolute URL to encode. */
  url: string
}

/** The 128px square the tile fills, held while the encoder loads. */
const TILE = {
  height: '128px',
  width: '128px',
  flexShrink: 0,
} satisfies CSSProperties

/** The code's quiet margin inside the Box's frame. */
const CODE_BODY = { padding: tokens.space[4] } satisfies CSSProperties

export function LinkQr({ url }: LinkQrProps) {
  return (
    <div style={TILE}>
      <Box fill body="flush" bodyStyle={CODE_BODY} className="su-sheet-qr-tile">
        <Suspense fallback={null}>
          <LinkQrCode url={url} />
        </Suspense>
      </Box>
    </div>
  )
}
