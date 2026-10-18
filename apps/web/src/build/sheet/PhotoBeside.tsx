/**
 * PhotoBeside — an identity card body with the entity's picture beside it
 * (`EntityPhoto`), or above it where the card is narrow. The layout is
 * `.su-photo-beside` (`styles/sheet/photo.css`), which queries the card's own
 * width; an `EntityPhoto` that renders nothing leaves the slot empty, and an
 * empty slot takes no room.
 */

import type { ReactNode } from 'react'

export function PhotoBeside({ photo, children }: { photo: ReactNode; children: ReactNode }) {
  return (
    <div className="su-photo-beside">
      <div className="su-photo-beside-row">
        <div className="su-photo-beside-slot">{photo}</div>
        <div className="su-photo-beside-content">{children}</div>
      </div>
    </div>
  )
}
