import type { GlobalProvider } from '@ladle/react'
import { Suspense, use, type ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import '../src/styles/ladle.css'

/**
 * Every story reads `SalvageUnionReference.*` fixtures at module top level
 * (e.g. `SalvageUnionReference.Systems.all()[0]`), which runs the instant
 * Ladle's router dynamically imports that story's chunk. Without a preload
 * gate ahead of that import, every model access throws "Schema not loaded"
 * (see salvageunion-reference's LazyModel guard) and the story renders
 * nothing — silently blank, not an error page. `apps/in-the-union-now`'s
 * `GameDataReady` and `apps/suref-web`'s `useGameData` use the same
 * `use()` + `Suspense` gate for the same reason; mirrored here so Ladle
 * (and the visual-regression harness built on it) actually renders content.
 */
let preloadPromise: Promise<void> | null = null

function getPreloadPromise(): Promise<void> {
  if (!preloadPromise) {
    preloadPromise = SalvageUnionReference.preload('all')
  }
  return preloadPromise
}

function PreloadGate({ children }: { children: ReactNode }) {
  use(getPreloadPromise())
  return <>{children}</>
}

// Global story canvas: every story renders on the same paper ground (so a story
// no longer needs its own `bg-paper` wrapper, and the couple that lacked one no
// longer render on Ladle's bare default). Padding + mono font are kept from the
// original inline frame.
export const Provider: GlobalProvider = ({ children }) => (
  <div
    className="min-h-screen bg-paper"
    style={{ padding: '1rem', fontFamily: 'Fira Code, monospace' }}
  >
    <Suspense fallback={null}>
      <PreloadGate>{children}</PreloadGate>
    </Suspense>
  </div>
)
