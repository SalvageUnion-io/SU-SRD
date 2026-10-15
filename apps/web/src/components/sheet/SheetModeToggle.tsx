/**
 * SheetModeToggle — the sheet band's Read | Edit (board 10; `sheetMode.model.ts`):
 * the shared `Segmented`, at a page head's action height so it stands as tall
 * as its neighbours (`.su-page-action`). The mode you are in is the ink plate;
 * `aria-pressed` carries it, so a screen reader hears which of the two is on.
 */

import { Segmented, SegmentedOption } from '../index'
import type { SheetMode } from './sheetMode.model'

/**
 * Only on a sheet the viewer may write: a read-only sheet has nothing to switch
 * to, so it prints no toggle (`Sheet.tsx`).
 */
export function SheetModeToggle({ mode, kind }: { mode: SheetMode; kind: string }) {
  return (
    <Segmented label={`Read or edit this ${kind}`} size="page">
      <SegmentedOption pressed={!mode.editing} onClick={() => mode.setEditing(false)}>
        Read
      </SegmentedOption>
      <SegmentedOption pressed={mode.editing} onClick={() => mode.setEditing(true)}>
        Edit
      </SegmentedOption>
    </Segmented>
  )
}
