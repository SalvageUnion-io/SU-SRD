import { Fragment } from 'react'
import { opensGroup } from 'salvageunion-reference'
import type { StatItem } from '../../components/containers/statsBarTypes'
import type { SizeRung } from '../../styles/sizing'
import { Facts } from './Facts'

/**
 * SEAM — the wider gap between two groups of a chip line (owner, 2026-10-14):
 * an empty item, so the line's own gap falls twice where a group ends.
 */
export function Seam() {
  return <span aria-hidden="true" className="su-chips__seam" />
}

/** Stat cells with a `Seam` wherever a new group opens (`opensGroup`). */
export function GroupedFacts({ cells, rung }: { cells: StatItem[]; rung: SizeRung }) {
  return (
    <>
      {cells.map((cell, index) => (
        <Fragment key={cell.key}>
          {opensGroup(cells, index) && <Seam />}
          <Facts cells={[cell]} size={rung} />
        </Fragment>
      ))}
    </>
  )
}
