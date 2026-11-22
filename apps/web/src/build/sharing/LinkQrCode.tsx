/** LinkQrCode — the code inside `LinkQr`'s tile, in its own chunk with the encoder. */

import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { tokens } from '../../components/index'
import { buildSharingCopy } from '../../messages/build-sharing'
import { qrGeometry } from './qrGeometry.model'

/** The encoder's SVG fills the body (`.su-sheet-qr > svg`). */
const CODE = { height: '100%' } satisfies CSSProperties

export function LinkQrCode({ url }: { url: string }) {
  const { size, path } = useMemo(() => qrGeometry(url), [url])
  return (
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
  )
}
