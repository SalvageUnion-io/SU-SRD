import { MobileSearchDialog } from 'component-lib'
import { IslandErrorBoundary } from './IslandErrorBoundary'
import { SearchIsland } from './SearchIsland'

/**
 * Mobile top-nav search for the srd. The generic trigger + sheet chrome lives
 * in component-lib's `MobileSearchDialog`; srd keeps its `SearchIsland`
 * combobox and injects it as the sheet content (with the width override that
 * makes the fixed-width combobox input fill the sheet).
 */
function MobileSearchIslandBody() {
  return (
    <MobileSearchDialog triggerAriaLabel="Search the SRD">
      {/* Force the combobox input (fixed w-52 by default) to fill the sheet. */}
      <div className="[&_input]:w-full [&_input]:focus:w-full">
        <SearchIsland />
      </div>
    </MobileSearchDialog>
  )
}

/**
 * Wrapped, like its sibling `SearchIsland`. All three of these hydrate together
 * inside `TopNavigation.astro`, and only the first was protected — so a render
 * error in the mobile search or the mobile nav took the header with it, which
 * is exactly the blank-page failure `IslandErrorBoundary` exists to contain.
 * The boundary also reports through `captureException`, so a crash here is now
 * visible in production rather than only to the person it happened to.
 */
export function MobileSearchIsland() {
  return (
    <IslandErrorBoundary>
      <MobileSearchIslandBody />
    </IslandErrorBoundary>
  )
}
