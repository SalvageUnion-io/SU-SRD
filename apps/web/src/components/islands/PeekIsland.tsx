import { SalvageUnionReference } from 'salvageunion-reference'
import { getSchemaPreloadList } from '../../lib/schemaPreloadDeps'
import { clientSwap } from '../../runtime/clientSwap'
import type { PeekLoader } from '../index'
import { PeekHost } from '../index'
import { ReferenceSurface } from '../ReferenceSurface'

/**
 * The schemas a Peek of one schema's entity reads: the entity's own and what
 * its card resolves on the way (the same per-schema list an item page loads),
 * so a trait's Peek costs the small core bundle and never the whole corpus.
 */
const loadForPeek: PeekLoader = (schemaName) =>
  SalvageUnionReference.preload(getSchemaPreloadList(schemaName))

/**
 * The page's one PEEK (entity display language E4, E16): every Mention and Tag
 * on the page — server-rendered or drawn by another island — carries its
 * entity's address, and this host shows that entity's compact card on hover,
 * focus or long-press.
 *
 * It takes no props and reads no game data on mount: the popup, its card and
 * the one schema bundle it shows load on the first Peek. It sits on the SRD's
 * surface (`ReferenceSurface`), so the Peek's name links to the entity's page.
 */
export function PeekIsland() {
  return (
    <ReferenceSurface>
      <PeekHost load={loadForPeek} />
    </ReferenceSurface>
  )
}

/** The island as Astro hydrates it: `PeekIsland` swapped in over its stand-in (`clientSwap`). */
export const PeekIslandClient = clientSwap('PeekIsland', PeekIsland)
