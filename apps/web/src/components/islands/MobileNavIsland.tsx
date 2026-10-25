import { UnionDrawer } from '../unionBar/UnionDrawer'
import { IslandErrorBoundary } from './IslandErrorBoundary'
import { SearchIsland } from './SearchIsland'

/**
 * The Union bar's phone drawer (`UnionDrawer`) on a reference page, with the
 * site's live search at its head.
 *
 * Zero props by design (astro/DESIGN.md rule 7): the drawer's catalog ships once
 * in its chunk, and the path is read from `location.pathname`.
 *
 * Wrapped, like its siblings: the chrome islands mount together inside the
 * bar, so an unwrapped render error in one would take the header with it.
 * The boundary also reports through `captureException`.
 */
export function MobileNavIsland() {
  return (
    <IslandErrorBoundary>
      <UnionDrawer search={<SearchIsland />} />
    </IslandErrorBoundary>
  )
}
