import { clientSwap } from '../../runtime/clientSwap'
import { KofiButton } from '../atoms/KofiButton'

/**
 * KofiIsland — the About page's Ko-fi button, the one part of the colophon
 * that needs client JS: `KofiButton` loads Ko-fi's script and swaps in
 * `getHTML()` from an effect. The colophon's prose around it renders
 * statically, so the page ships none of it twice.
 *
 * Deliberately NOT wrapped in `IslandErrorBoundary`: no SRD data and no
 * async render work, so nothing here can throw at render.
 */
export function KofiIsland({ code }: { code: string }) {
  return <KofiButton code={code} />
}

/** The island as Astro hydrates it: `KofiIsland` swapped in over its stand-in (`clientSwap`). */
export const KofiIslandClient = clientSwap('KofiIsland', KofiIsland)
