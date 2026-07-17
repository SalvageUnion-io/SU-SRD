import { KofiButton } from 'component-lib'

/**
 * KofiButtonIsland — hydrates the shared Ko-fi widget button on the About page.
 *
 * A React island (not an inline Ko-fi snippet) because srd uses Astro's
 * ClientRouter: the widget's `document.write`-based `draw()` would wipe the page
 * on a client-side navigation. The shared KofiButton loads the script and uses
 * `getHTML()`, and this island re-hydrates across view transitions.
 */
export function KofiButtonIsland() {
  return <KofiButton code="C3Z82382ZC" />
}
