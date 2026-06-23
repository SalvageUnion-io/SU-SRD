/**
 * ShareQrCode — renders a real, scannable QR code for a published share URL.
 *
 * Encodes the URL with the in-tree zero-dependency encoder
 * (`lib/snapshot/qr.ts`, byte mode / EC level M) and draws the module matrix as
 * a single crisp SVG `<path>` with a quiet-zone margin. Because the QR now
 * conveys real, actionable information, it carries `role="img"` + an
 * `aria-label` (it is no longer a decorative `aria-hidden` placeholder).
 *
 * Rendering is gated by the caller on `shareUrl` being non-null — this
 * component is only mounted after publish.
 */

import { useMemo } from 'react'

import { encodeQrMatrix, qrMatrixToSvgPath } from '../../lib/snapshot/qr'

type ShareQrCodeProps = {
  /** The published share URL to encode. */
  url: string
  /** Rendered pixel size (square). Defaults to the design's 84px. */
  size?: number
}

// Modules of quiet zone around the symbol (the spec recommends ≥ 4).
const QUIET_ZONE = 4

export function ShareQrCode({ url, size = 84 }: ShareQrCodeProps) {
  const { path, viewBox } = useMemo(() => {
    const matrix = encodeQrMatrix(url)
    const dim = matrix.length + QUIET_ZONE * 2
    return {
      path: qrMatrixToSvgPath(matrix),
      viewBox: `${-QUIET_ZONE} ${-QUIET_ZONE} ${dim} ${dim}`,
    }
  }, [url])

  return (
    <svg
      role="img"
      aria-label="QR code for the share URL"
      width={size}
      height={size}
      viewBox={viewBox}
      shapeRendering="crispEdges"
      className="h-[84px] w-[84px] shrink-0 rounded-[3px] border-[1.5px] border-ink bg-white"
    >
      <path d={path} fill="var(--color-ink)" />
    </svg>
  )
}
