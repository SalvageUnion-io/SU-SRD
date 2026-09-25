import { MobileSearchDialog } from '../MobileSearchDialog'
import { IslandErrorBoundary } from './IslandErrorBoundary'
import { SearchIsland } from './SearchIsland'

/**
 * Mobile top-nav search for the srd. The generic trigger + sheet chrome lives
 * in `MobileSearchDialog`; srd keeps its `SearchIsland`
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
 * Wrapped, like its siblings `SearchIsland` and the other mobile island. All
 * three mount together inside `TopNavigation`, so an unwrapped render error in
 * one takes the header with it — the blank-page failure `IslandErrorBoundary`
 * exists to contain. The boundary also reports through `captureException`, so a
 * crash here is visible in production.
 */
export function MobileSearchIsland() {
  return (
    <IslandErrorBoundary>
      <MobileSearchIslandBody />
    </IslandErrorBoundary>
  )
}
