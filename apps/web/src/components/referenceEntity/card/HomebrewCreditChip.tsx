import type { Size } from '../../../styles/sizing'
import { relation, Tag } from '../../entity'

/** Where a built-in Homebrew Pattern was published, who designed it, and the post. */
export type HomebrewCredit = { source: string; author: string; href?: string | undefined }

/**
 * A built-in Homebrew Pattern's credit chip, beside its HOMEBREW stamp:
 * `MECH MONDAY | Murkdice`. `linkable` opens the post it came from; a row
 * that is itself a link leaves it plain.
 */
export function HomebrewCreditChip({
  credit,
  size,
  linkable = false,
}: {
  credit: HomebrewCredit
  size: Size
  linkable?: boolean
}) {
  return (
    <Tag
      tag={relation('credit', credit.source, credit.author, { href: credit.href })}
      linkable={linkable}
      size={size}
      wrap
    />
  )
}
