/**
 * The drift line (r6 E2): a mech whose loadout is no longer its pattern's
 * says how, from the mech's side ("Removed Hydraulic Crusher · added Red
 * Laser (vs Grinder Scrapper)"), as the body's first line in Read and Edit
 * alike, and carries what to do about it where the viewer writes the mech:
 *
 * - **Update the pattern from this Mech**, where the pattern is the viewer's
 *   own: the mech's Systems and Modules are written over the pattern, which
 *   keeps its id, links and share settings (`replacePattern`, its notice's
 *   Undo puts the old build back). The pattern alone changes
 *   (the E2 ruling in `build/rulings.model.ts`): other mechs built from it show their own drift.
 * - **Bring back to the pattern** (r5 D2): the pattern's Systems and Modules
 *   back on the mech, at once, with the sheet's Undo line. Damage, Heat and
 *   cargo stay.
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { CSSProperties } from 'react'
import { Button, Text, toast, tokens } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { PatternStamp } from './bandStamps.model'
import type { SheetPatch } from './sheetViewProps.model'
import { undoToast } from './undoToast.model'

const LINE = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  margin: `0 0 ${tokens.space[16]}`,
} satisfies CSSProperties

const WORDS = { flex: '1 1 16rem', margin: 0 } satisfies CSSProperties

/** Write the mech's build over its pattern; the pattern keeps its id, links and share. */
async function updatePattern(mech: Mech, stamp: PatternStamp, patternId: string) {
  try {
    const { replacePattern } = await import('../mech/Pattern/buildConfirm.model')
    await replacePattern(patternId, mech)
  } catch (err) {
    toast.error(failureMessage(err, buildSheetCopy('patternNotUpdated', { pattern: stamp.name })))
  }
}

export function PatternCatchUp({
  mech,
  stamp,
  patch,
}: {
  mech: Mech
  stamp: PatternStamp & { loadout: NonNullable<PatternStamp['loadout']> }
  /** Absent where the viewer may not write the mech: the line only says how it differs. */
  patch?: SheetPatch | undefined
}) {
  const { loadout } = stamp
  const names = { name: mech.name, pattern: stamp.name }
  const patternId = stamp.own ? mech.sourcePattern : undefined
  return (
    <section aria-label={buildSheetCopy('driftLabel', { name: mech.name })} style={LINE}>
      <Text variant="note" style={WORDS}>
        {buildSheetCopy('driftVs', { differs: stamp.differs ?? '', pattern: stamp.name })}
      </Text>
      {patch && patternId !== undefined && (
        <Button size="compact" onClick={() => void updatePattern(mech, stamp, patternId)}>
          {buildSheetCopy('updateThePattern')}
        </Button>
      )}
      {patch && (
        <Button
          size="compact"
          onClick={() => {
            const before = { systems: mech.systems, modules: mech.modules }
            patch({ systems: [...loadout.systems], modules: [...loadout.modules] })
            undoToast(buildSheetCopy('broughtUpToDate', names), () => patch(before), mech.id)
          }}
        >
          {buildSheetCopy('bringBackToPattern')}
        </Button>
      )}
    </section>
  )
}
