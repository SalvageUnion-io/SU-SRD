import type { CSSProperties } from 'react'
import { Toaster as SonnerToaster } from 'sonner'
import { borderWidth, color, font, fontSize, radius, shadow } from '../../design/tokens'

/** Sonner's own radius variable, set to the popup radius (ruleset §4.4). */
const TOASTER = { '--border-radius': radius.card } as CSSProperties

/** A toast: ink, paper text, the popup radius and the one lift (chrome K4). */
const TOAST = {
  background: color.ink,
  border: `${borderWidth.hairline} solid ${color.ink2}`,
  borderRadius: radius.card,
  boxShadow: shadow.lift,
  color: color.paper,
  fontFamily: font.body,
  fontSize: fontSize.caption,
} satisfies CSSProperties

/**
 * A phone's toast stands clear of a tab row at the screen's foot and of the
 * home indicator: `--su-toast-bottom` (`styles/partials/atoms-leaves.css`).
 */
const MOBILE_OFFSET = { bottom: 'var(--su-toast-bottom)' } as const

/**
 * The toast region, as configured. Render it only through `ToasterMount`,
 * which keeps it to one per document (chrome K5). Its own module, loaded when
 * a toaster first mounts, so a reference page's islands never ship sonner
 * until one draws.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      mobileOffset={MOBILE_OFFSET}
      style={TOASTER}
      toastOptions={{
        style: TOAST,
        // The status icon's colour: `.su-toast--ok` / `--bad`; the
        // description's paper: `.su-toast__description` (atoms-leaves.css).
        classNames: {
          success: 'su-toast--ok',
          error: 'su-toast--bad',
          description: 'su-toast__description',
        },
      }}
    />
  )
}
