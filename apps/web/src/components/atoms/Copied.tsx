import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * The copy control's own icon (chrome K5): `icon` at rest, a `Check` of the
 * same size for the moment after a copy lands (`useCopied`).
 */
export function CopiedIcon({
  copied,
  icon,
  size,
}: {
  copied: boolean
  /** The control's resting icon, `aria-hidden`. */
  icon: ReactNode
  /** The resting icon's size, which the Check takes. */
  size: number
}) {
  return copied ? <Check aria-hidden="true" size={size} /> : icon
}

/**
 * The polite live region beside a copy control: "Copied" for a screen reader
 * when the Check shows, empty otherwise. Always mounted, so the change is
 * announced. Never a toast (chrome K5).
 */
export function CopiedStatus({ copied }: { copied: boolean }) {
  return (
    <span role="status" className="su-sr-only">
      {copied ? 'Copied' : ''}
    </span>
  )
}
