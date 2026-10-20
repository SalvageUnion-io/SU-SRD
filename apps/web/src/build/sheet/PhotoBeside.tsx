/**
 * PhotoBeside — an identity card body with the entity's picture beside its
 * first fields (`EntityPhoto`), or above them where the card is narrow. What
 * comes `below` (the long prose: a Bio, a Description) runs the card's full
 * width under the photo, so no empty column stands under the picture (owner's
 * review, 2026-10-20: the sheets' whitespace). The layout is `.su-photo-beside`
 * (`styles/build/sheet/photo.css`), which queries the card's own width; an
 * `EntityPhoto` that renders nothing leaves the slot empty, and an empty slot
 * takes no room.
 */

import type { ReactNode } from 'react'

export function PhotoBeside({
  photo,
  below,
  children,
}: {
  photo: ReactNode
  /** The card's full-width rest, under the photo and the fields beside it. */
  below?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="su-photo-beside">
      <div className="su-photo-beside-row">
        <div className="su-photo-beside-slot">{photo}</div>
        <div className="su-photo-beside-content">{children}</div>
      </div>
      {below && <div className="su-photo-beside-below">{below}</div>}
    </div>
  )
}
