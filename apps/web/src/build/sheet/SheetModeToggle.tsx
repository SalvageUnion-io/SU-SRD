/**
 * SheetModeToggle — the sheet band's Read | Edit | Play (`sheetMode.model.ts`,
 * ADR-066): one page per unit, its modes one shared `Segmented`, at a page
 * head's action height so it stands as tall as its neighbours
 * (`.su-page-action`). The mode you are in is the ink plate; `aria-pressed`
 * carries it, so a screen reader hears which is on. Play opens the pilot's Play
 * mode (`/pilots/:id/play`): a pilot's own, or a mech's assigned pilot's.
 */

import { Segmented, SegmentedOption } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { SheetMode } from './sheetMode.model'

type SheetModeToggleProps = {
  /** Read | Edit, where the viewer may write; null prints Play alone. */
  mode: SheetMode | null
  kind: string
  /** Opens Play for this pilot, where there is one to play. */
  play?: { name: string; onPlay: () => void }
}

export function SheetModeToggle({ mode, kind, play }: SheetModeToggleProps) {
  return (
    <Segmented label={buildSheetCopy('readOrEditThis', { kind })} size="compact">
      {mode !== null && (
        <SegmentedOption pressed={!mode.editing} onClick={() => mode.setEditing(false)}>
          {buildSheetCopy('read')}
        </SegmentedOption>
      )}
      {mode !== null && (
        <SegmentedOption pressed={mode.editing} onClick={() => mode.setEditing(true)}>
          {buildSheetCopy('edit')}
        </SegmentedOption>
      )}
      {play && (
        <SegmentedOption
          pressed={false}
          onClick={play.onPlay}
          aria-label={buildSheetCopy('playAs', { name: play.name })}
        >
          {buildSheetCopy('play')}
        </SegmentedOption>
      )}
    </Segmented>
  )
}
