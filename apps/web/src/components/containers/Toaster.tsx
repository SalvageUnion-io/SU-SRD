// eslint-disable-next-line react-refresh/only-export-components
export { toast } from 'sonner'

import type { CSSProperties } from 'react'
import { useEffect, useState, useSyncExternalStore } from 'react'
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
 * The toast region, as configured. Render it only through `ToasterMount`,
 * which keeps it to one per document (chrome K5); a test may render it beside
 * what it tests.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
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

/**
 * Who draws the document's one toaster: every mounted `ToasterMount`, in mount
 * order; the first draws it, the rest wait their turn.
 */
let mounts: readonly symbol[] = []
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const setMounts = (next: readonly symbol[]) => {
  mounts = next
  for (const listener of listeners) listener()
}
const firstMount = () => mounts[0]
const noMount = () => undefined

/**
 * Asks for the document's one `Toaster` (chrome K5, hard rule R20). The app's
 * root and each SRD island that toasts (a roll) render this; the first mounted
 * draws the toaster where it stands (a fixed region, so its place in the tree
 * does not show) and the rest share it, so a page with three islands still has
 * one toast region. When the one drawing it
 * unmounts, the next in line takes it over.
 */
export function ToasterMount() {
  const [id] = useState(() => Symbol('toaster'))
  const first = useSyncExternalStore(subscribe, firstMount, noMount)
  useEffect(() => {
    setMounts([...mounts, id])
    return () => setMounts(mounts.filter((m) => m !== id))
  }, [id])
  return first === id ? <Toaster /> : null
}
