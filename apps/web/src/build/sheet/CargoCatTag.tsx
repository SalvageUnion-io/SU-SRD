/**
 * CargoCatTag — a lot's kind on its hold row ("Sealed", "System", "Power"),
 * which says what it means on press or hover (r5 B4): a tag nothing explained
 * read as a state the player had to guess at.
 */

import type { CargoLot } from 'game-domain/schemas/cargoLot'
import { PopoverPanel } from '../../components/app'
import { Button } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'

/** What the tag means, each key said as a literal so the catalogue sees it. */
function meaning(cat: Exclude<CargoLot['cat'], 'SCRAP'>): string {
  if (cat === 'SEALED') return buildSheetCopy('cargoSealedMeans')
  if (cat === 'SYSTEM') return buildSheetCopy('cargoSystemMeans')
  return buildSheetCopy('cargoPowerMeans')
}

/** The row's tag for `cat`; Scrap carries none (its Tech Level says it). */
export function CargoCatTag({ cat }: { cat: CargoLot['cat'] }) {
  if (cat === 'SCRAP') return null
  return (
    <PopoverPanel
      trigger={
        <Button variant="ghost" size="mini">
          {cat}
        </Button>
      }
      label={cat}
      openOnHover
      side="top"
      align="center"
    >
      <span>{meaning(cat)}</span>
    </PopoverPanel>
  )
}
