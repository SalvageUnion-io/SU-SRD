/*
 * The data gate shipped with the design-system bundle.
 *
 * Nearly every component in this library reads the Salvage Union reference ORM
 * (`SalvageUnionReference.Systems.all()`, `Chassis.find()`, …). That data is
 * loaded lazily: before `preload()` resolves, every data method throws
 * "Schema not loaded" (see salvageunion-reference's LazyModel guard), so a
 * component that renders before the load completes renders nothing at all —
 * silently blank, not an error.
 *
 * Both real consumers already solve this the same way: `apps/itun`'s
 * `GameDataReady` and `apps/srd`'s `useGameData` both gate their tree on the
 * same `use()` + `Suspense` pair. This is that gate, bundled so a design built
 * from this library can wrap in it directly.
 *
 * It is deliberately NOT a visual wrapper — no background, no padding, no font.
 * Ladle's equivalent (`.ladle/components.tsx`) adds a paper ground because a
 * story catalog needs one; a real page owns its own layout, and baking one in
 * here would put an unremovable frame around every design.
 *
 * Lives in `.design-sync/` rather than in `packages/component-lib/src` on
 * purpose: it is bundled into the design-system artifact via
 * `cfg.extraEntries`, which keeps the package's own public API unchanged.
 */
import { type ReactNode, Suspense, use } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

// One promise for the whole page — `use()` re-reads it on every render, and a
// fresh promise per render would suspend forever.
let preloadPromise: Promise<void> | null = null

function getPreloadPromise(): Promise<void> {
  if (!preloadPromise) {
    preloadPromise = SalvageUnionReference.preload('all')
  }
  return preloadPromise
}

function Gate({ children }: { children?: ReactNode }) {
  use(getPreloadPromise())
  return <>{children}</>
}

/**
 * Wrap anything that renders Salvage Union reference data. Renders nothing
 * until the dataset has loaded, then renders `children` normally.
 */
export function SalvageUnionDataProvider({
  children,
  fallback = null,
}: {
  children?: ReactNode
  /** Shown while the dataset loads. Defaults to nothing. */
  fallback?: ReactNode
}) {
  return (
    <Suspense fallback={fallback}>
      <Gate>{children}</Gate>
    </Suspense>
  )
}
