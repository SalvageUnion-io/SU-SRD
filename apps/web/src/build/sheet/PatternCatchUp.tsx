/**
 * The drift line (r6 E2): a mech whose loadout is no longer its pattern's
 * says how, each side from the side that has more ("Longhaul has 3 Systems
 * this Mech lacks: …", r7 G3; "Added Red Laser (vs Longhaul)"), as the body's
 * first line in Read and Edit alike, and carries what to do about it where
 * the viewer writes the mech:
 *
 * - **Behind** (r8 E3): the Mech only lacks what the pattern has, as after
 *   its pattern gained something, so the one way on is **Bring in the
 *   pattern's changes**. It is never offered to write itself over the
 *   pattern, which would take the change back for every Mech built from it.
 * - **Ahead**, where the Mech changed: **Update the pattern from this Mech**,
 *   where the pattern is the viewer's own (`replacePattern`: the pattern keeps
 *   its id, links and share; its notice says how many other Mechs use it and
 *   offers Bring them up to date, r8 E2), **Bring back to the pattern** (r5
 *   D2), and **Save as a new pattern** (r8 E4), which keeps both builds.
 *
 * Bringing in or back writes the pattern's Systems and Modules on the Mech at
 * once, with the sheet's Undo line. Damage, Heat and cargo stay.
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { CSSProperties } from 'react'
import { lazy, Suspense, useState } from 'react'
import { Button, Text, toast, tokens } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { useOpenedOnce } from '../../lib/useOpenedOnce'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { PatternStamp } from './bandStamps.model'
import type { SheetPatch } from './sheetViewProps.model'
import { undoToast } from './undoToast.model'

const SavePatternDialog = lazy(() =>
  import('../mech/Pattern/SavePatternDialog').then((m) => ({ default: m.SavePatternDialog }))
)

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
    await replacePattern(patternId, mech, mech.id)
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
  const [saving, setSaving] = useState(false)
  const savingMounted = useOpenedOnce(saving)
  const names = { name: mech.name, pattern: stamp.name }
  const patternId = stamp.own ? mech.sourcePattern : undefined
  // Behind its pattern: only the pattern's changes come in (r8 E3).
  const behind = stamp.lacksOnly === true
  const bring = () => {
    const before = { systems: mech.systems, modules: mech.modules }
    const wrote = { systems: [...loadout.systems], modules: [...loadout.modules] }
    patch?.(wrote)
    undoToast(buildSheetCopy('broughtUpToDate', names), () => patch?.(before), mech.id, {
      wrote,
    })
  }
  return (
    <section aria-label={buildSheetCopy('driftLabel', { name: mech.name })} style={LINE}>
      <Text variant="note" style={WORDS}>
        {stamp.differs}
      </Text>
      {patch && !behind && patternId !== undefined && (
        <Button size="compact" onClick={() => void updatePattern(mech, stamp, patternId)}>
          {buildSheetCopy('updateThePattern')}
        </Button>
      )}
      {patch && (
        <Button size="compact" onClick={bring}>
          {behind ? buildSheetCopy('bringInPatternChanges') : buildSheetCopy('bringBackToPattern')}
        </Button>
      )}
      {patch && !behind && (
        <Button size="compact" onClick={() => setSaving(true)}>
          {buildSheetCopy('saveAsNewPattern')}
        </Button>
      )}
      {savingMounted && (
        <Suspense fallback={null}>
          <SavePatternDialog
            source={{ ...mech, sourcePattern: undefined }}
            open={saving}
            onOpenChange={setSaving}
          />
        </Suspense>
      )}
    </section>
  )
}
