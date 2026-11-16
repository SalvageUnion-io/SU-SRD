/**
 * LinkQr — renders a share URL as a scannable QR code: a public sheet's `/p/:kind/:appId`.
 *
 * SVG output (not canvas): drawn synchronously from the encoder's module grid,
 * deterministic under happy-dom tests and crisp at any DPI. The tile is the house `Box` (its paper body, ink frame) with an
 * encoder quiet zone — QR readers need dark-on-light regardless of app theme.
 *
 * Lives in the app, not src/components: the app is its only renderer, and keeping it
 * in the library meant the library's manifest declared `qrcode` for one app's
 * sake. Covered by `__tests__/ShareStatusDialog.connected.test.tsx`.
 */

import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { Box, tokens } from '../../components/index'
import { buildSharingCopy } from '../../messages/build-sharing'
import { qrGeometry } from './qrGeometry.model'

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
  const { size, path } = useMemo(() => qrGeometry(url), [url])
  return (
    <div style={TILE}>
      <Box fill body="flush" bodyStyle={CODE_BODY} className="su-sheet-qr-tile">
        <div
          role="img"
          aria-label={buildSharingCopy('qrCodeLinkingToThis')}
          data-testid="share-qr"
          className="su-sheet-qr"
          style={CODE}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${size} ${size}`}
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            <rect width={size} height={size} fill={tokens.color.paper} />
            <path d={path} fill={tokens.color.ink} />
          </svg>
        </div>
      </Box>
    </div>
  )
}
