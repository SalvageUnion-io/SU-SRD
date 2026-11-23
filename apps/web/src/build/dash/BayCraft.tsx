/**
 * BayCraft — the Crafting Bay's Craft on the crawler sheet (r7 D7, SB7-16):
 * the same craft panel Play's Downtime opens (`CraftingBay`), opened in the
 * bay's detail, the docked Mech the one it may mount on. Loaded only once
 * Craft is pressed (the sheet route's bundle budget). A Damaged bay has no
 * Craft: its detail says what Damaged does (Core Book p.222).
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import { lazy, Suspense, useState } from 'react'
import { Button } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { UnitsStore } from '../../replica/units'

const CraftingBay = lazy(() =>
  import('../../play/PlayDowntimeCraftTrade').then((m) => ({ default: m.CraftingBay }))
)

export function BayCraft({
  crawler,
  mech,
  store,
}: {
  crawler: Crawler
  mech: Mech | null
  store: UnitsStore
}) {
  const [open, setOpen] = useState(false)
  const storeState = store()
  return (
    <div className="su-play-resolve">
      <div>
        <Button size="mini" aria-expanded={open} onClick={() => setOpen((was) => !was)}>
          {buildSheetCopy('craft')}
        </Button>
      </div>
      {open && (
        <Suspense fallback={null}>
          <CraftingBay crawler={crawler} mech={mech} store={storeState} canWrite />
        </Suspense>
      )}
    </div>
  )
}
