// eslint-disable-next-line react-refresh/only-export-components
export { toast } from './toast'

import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react'

/** The toast region itself, loaded on first draw (`SonnerToaster.tsx`). */
const Toaster = lazy(() => import('./SonnerToaster').then(({ Toaster }) => ({ default: Toaster })))

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
 * Asks for the document's one `Toaster` (chrome K5). The app's
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
  return first === id ? (
    <Suspense fallback={null}>
      <Toaster />
    </Suspense>
  ) : null
}
