import type { PeekLoader } from 'component-lib'
import { PeekHost } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { getSchemaPreloadList } from '../../lib/schemaPreloadDeps'

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
 * the one schema bundle it shows load on the first Peek.
 */
export function PeekIsland() {
  return <PeekHost load={loadForPeek} />
}
