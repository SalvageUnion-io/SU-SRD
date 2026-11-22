/**
 * CargoCatTag — a lot's kind on its hold row ("Sealed", "System", "Power"),
 * which says what it means on press or hover (r5 B4): a tag nothing explained
 * read as a state the player had to guess at.
 */

import type { CargoLot } from 'game-domain/schemas/cargoLot'
import { PopoverPanel } from '../../components/app'
import { FOCUS_RING } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'

const MEANING = {
  SEALED: 'cargoSealedMeans',
  SYSTEM: 'cargoSystemMeans',
  POWER: 'cargoPowerMeans',
} as const

/** The row's tag for `cat`; Scrap carries none (its Tech Level says it). */
export function CargoCatTag({ cat }: { cat: CargoLot['cat'] }) {
  if (cat === 'SCRAP') return null
  return (
    <PopoverPanel
      trigger={
        <button type="button" className={`su-stat-provenance__trigger ${FOCUS_RING}`}>
          {cat}
        </button>
      }
      label={cat}
      openOnHover
      side="top"
      align="center"
    >
      <span>{buildSheetCopy(MEANING[cat])}</span>
    </PopoverPanel>
  )
}
