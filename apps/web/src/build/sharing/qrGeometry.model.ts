/** qrGeometry — a share URL's QR code as SVG geometry, for `LinkQr`. */

import QRCode from 'qrcode'

/** The QR quiet zone, in modules. */
const MARGIN = 1

/**
 * The code's dark modules as one SVG path: a 1×1 square per module, joined
 * into runs along each row. Built from the encoder's module grid and drawn as
 * React elements, so no markup string reaches `innerHTML` (a Trusted Types
 * sink, `lib/trustedTypes.ts`).
 */
export function qrGeometry(url: string): { size: number; path: string } {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' })
  let path = ''
  for (let row = 0; row < modules.size; row++) {
    let col = 0
    while (col < modules.size) {
      if (!modules.get(row, col)) {
        col++
        continue
      }
      const start = col
      while (col < modules.size && modules.get(row, col)) col++
      path += `M${start + MARGIN} ${row + MARGIN}h${col - start}v1h${start - col}z`
    }
  }
  return { size: modules.size + MARGIN * 2, path }
}
