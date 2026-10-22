/**
 * SheetColumns — a Live Sheet's two columns (ruleset §1.2): the opening and
 * the sheet's main column, and the permanent right sidebar that holds what the
 * unit carries (a pilot's equipment, a mech's hold, a crawler's Storage Bay).
 *
 * The opening (`SheetHero`) keeps the sheet's width. From the 64rem rung
 * (chrome K2) the sidebar is a column beside the main column under it, never
 * collapsed: no fold, no drawer. Below it, on a phone, it stacks straight
 * under the opening, before the main column, so what the unit carries is the
 * next thing a player reaches.
 *
 * Pure layout, one grid every kind shares (hard rule R11, `.su-sheet-columns`
 * in `styles/build/sheet/chrome.css`); each region is its own inline-size
 * container, so what is inside it queries its own width, not the sheet's.
 * With nothing carried (Read leaves an empty section out; an NPC carries
 * nothing) there is no sidebar, and the main column takes the width.
 */

import type { ReactNode } from 'react'

type SheetColumnsProps = {
  /** The opening: `SheetHero`. */
  hero: ReactNode
  /** What the unit carries, the sidebar's sections; omitted or empty, no sidebar. */
  aside?: ReactNode
  /** The sidebar's name (`<unit> carries`), a complementary landmark's. */
  asideLabel: string
  /** The main column's sections, after the opening. */
  children?: ReactNode
}

export function SheetColumns({ hero, aside, asideLabel, children }: SheetColumnsProps) {
  const carries = aside !== null && aside !== undefined && aside !== false
  return (
    <div className="su-sheet-columns">
      <div className="su-sheet-columns__hero">{hero}</div>
      {carries && (
        <aside aria-label={asideLabel} className="su-sheet-aside" data-sheet-aside="">
          {aside}
        </aside>
      )}
      <div className="su-sheet-columns__main">{children}</div>
    </div>
  )
}
