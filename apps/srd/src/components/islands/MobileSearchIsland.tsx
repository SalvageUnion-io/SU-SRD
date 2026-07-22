import { MobileSearchDialog } from 'component-lib'
import { SearchIsland } from './SearchIsland'

/**
 * Mobile top-nav search for the srd. The generic trigger + sheet chrome lives
 * in component-lib's `MobileSearchDialog`; srd keeps its `SearchIsland`
 * combobox and injects it as the sheet content (with the width override that
 * makes the fixed-width combobox input fill the sheet).
 */
export function MobileSearchIsland() {
  return (
    <MobileSearchDialog triggerAriaLabel="Search the SRD">
      {/* Force the combobox input (fixed w-52 by default) to fill the sheet. */}
      <div className="[&_input]:w-full [&_input]:focus:w-full">
        <SearchIsland />
      </div>
    </MobileSearchDialog>
  )
}
