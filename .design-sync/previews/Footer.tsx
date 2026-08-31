/*
 * Ported from packages/component-lib/src/components/shared/Footer.stories.tsx.
 *
 * The `poweredBySalvageUrl` asset lives in each APP's public dir, not in the
 * library, so the logo cannot resolve from a shared-library preview any more
 * than it can from the story. The path is passed as the apps pass it and the
 * broken image is left visible rather than swapped for a fake — a design built
 * from this component must supply that asset itself.
 */
import { Footer } from 'component-lib'

/** The site footer — Leyline Press copyright, the Salvage Union OGL 1.0b attribution, and the "Powered by Salvage" logo. */
export function SiteFooter() {
  return (
    <div className="bg-paper">
      <Footer poweredBySalvageUrl="/Powered_by_Salvage_Black.webp" />
    </div>
  )
}
