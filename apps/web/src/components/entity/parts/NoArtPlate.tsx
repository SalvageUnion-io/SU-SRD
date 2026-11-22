import { cn } from '../../../lib/cn'
import { entityCopy } from '../../../messages/components-entity'
import { capsLabel } from '../../atoms/capsLabel'

const LABEL = cn('su-no-art__label', capsLabel({ tracking: 'snug' }))

/**
 * NO ART PLATE — what fills an art-less index Compact's art place in a catalog
 * that has art (r5 E7): a quiet paper plate reading "No illustration" over
 * where the book prints it ("Workshop Manual · p.82"), so the index Compacts
 * keep one height and nothing reads as withheld from the reader.
 *
 * Decoration (`aria-hidden`): the index Compact's name is its label and its
 * page cites the book. Layout is `entity-art.css`'s `.su-no-art*`.
 */
export function NoArtPlate({ cite }: { cite: string | undefined }) {
  return (
    <span className="su-no-art" data-no-art="" aria-hidden="true">
      <span className={LABEL}>{entityCopy('noIllustration')}</span>
      {cite && <span className="su-no-art__cite">{cite}</span>}
    </span>
  )
}
