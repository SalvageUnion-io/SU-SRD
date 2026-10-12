import type { TableDie } from 'component-lib'
import { dieForTable } from 'component-lib'
import { useState } from 'react'
import type { ScreenTable } from '../../lib/screenPage'
import { ScreenTableView } from '../ScreenView'
import { IslandErrorBoundary } from './IslandErrorBoundary'

type ScreenTableIslandProps = {
  panel: ScreenTable
  /**
   * The die for this table. Injectable so a test controls the roll; defaults
   * to `dieForTable`, as the roll-table page's island does.
   */
  dieFor?: (tableName: string) => Promise<TableDie>
}

/**
 * One table on the Mediator Screen, live: Roll, and its row is marked where
 * the table sits. Its props are the table already digested at build time, and
 * the dice package loads on the first Roll (`dieForTable`'s dynamic import).
 */
export function ScreenTableIsland({ panel, dieFor = dieForTable }: ScreenTableIslandProps) {
  const [roll, setRoll] = useState<number | null>(null)

  const onRoll = () => {
    void dieFor(panel.data.name).then((d20) => setRoll(d20()))
  }

  return (
    <IslandErrorBoundary>
      <ScreenTableView panel={panel} roll={roll} onRoll={onRoll} />
    </IslandErrorBoundary>
  )
}
