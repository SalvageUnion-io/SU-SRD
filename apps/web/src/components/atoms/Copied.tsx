import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { iconSize } from '../../design/tokens'
import { atomsCopy } from '../../messages/components-atoms'

/**
 * The copy control's own icon (chrome K5): `icon` at rest, a `Check` of the
 * same size for the moment after a copy lands (`useCopied`), with the word
 * "Copied" where `word` asks for it.
 */
export function CopiedIcon({
  copied,
  icon,
  size,
}: {
  copied: boolean
  /** The control's resting icon, `aria-hidden`. */
  icon: ReactNode
  /** The line's Size, the resting icon's (`iconSize`), which the Check takes. */
  size: keyof typeof iconSize
  /**
   * Say "Copied" beside the Check, where an icon-only control gave a sighted
   * reader too little to see (r3 L6). Hidden from a screen reader, which
   * hears `CopiedStatus`.
   */
  word?: boolean
}) {
  if (!copied) return icon
  return (
    <>
      <Check aria-hidden="true" size={iconSize[size]} />
      {word && <span aria-hidden="true">{atomsCopy('copied')}</span>}
    </>
  )
}

/**
 * The polite live region beside a copy control: "Copied" for a screen reader
 * when the Check shows, empty otherwise. Always mounted, so the change is
 * announced. Never a toast (chrome K5).
 */
export function CopiedStatus({ copied }: { copied: boolean }) {
  return (
    <span role="status" className="su-sr-only">
      {copied ? atomsCopy('copied') : ''}
    </span>
  )
}
