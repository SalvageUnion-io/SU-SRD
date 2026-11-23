/**
 * PatternMechs — on a pattern's page, the viewer's own Mechs built from it
 * (r7 G2): each named, linked to its sheet and marked Up to date or Behind,
 * as its sheet's drift line reads it (`mechPatternStamp`). Where any is
 * behind, one Bring all up to date asks first, naming what it will change on
 * each, then writes the pattern's Systems and Modules on every one of them at
 * once; its notice's Undo puts each loadout back. Damage, Heat and cargo stay,
 * as the sheet's Bring back to the pattern leaves them.
 *
 * Loaded only where the viewer holds such a Mech (`PublicPattern`).
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { MechPattern } from 'game-domain/schemas/pattern'
import type { LedgerColumn } from '../../../components/index'
import { Button, Ledger, toast } from '../../../components/index'
import { useConfirm } from '../../../components/shared/useConfirm'
import { failureMessage } from '../../../lib/connection/useServerAction'
import { mechCopy } from '../../../messages/build-mech'
import { buildShelvesCopy } from '../../../messages/build-shelves'
import { LIVE_SHEET_MANUAL } from '../../../replica/provenance'
import { useUnits } from '../../../replica/units'
import type { PatternStamp } from '../../sheet/bandStamps.model'
import { mechPatternStamp } from '../../sheet/bandStamps.model'
import { restoreToast } from './buildConfirm.model'

const COLUMNS: readonly LedgerColumn[] = [
  { key: 'status', label: mechCopy('patternMechStatus'), kind: 'text', phone: true },
]

type Loadout = { systems: string[]; modules: string[] }

/** A Mech built from the pattern, beside how it stands against it now. */
type PatternMech = { mech: Mech; stamp: PatternStamp | undefined }

/** The viewer's Mechs built from `pattern`, each with its drift from it. */
function patternMechs(pattern: MechPattern, mechs: readonly Mech[]): PatternMech[] {
  return mechs
    .filter((mech) => mech.sourcePattern === pattern.id)
    .map((mech) => ({ mech, stamp: mechPatternStamp(mech, () => pattern) }))
}

/** Behind: its loadout is no longer the pattern's (a Mech moved to another chassis is not compared). */
const isBehind = (row: PatternMech): boolean => row.stamp?.changed === true

/** Write each loadout in turn; the first refusal stops the run. */
async function writeLoadouts(writes: readonly { id: string; loadout: Loadout }[]): Promise<void> {
  for (const { id, loadout } of writes)
    await useUnits.getState().update('mech', id, loadout, LIVE_SHEET_MANUAL)
}

/** Bring every behind Mech to the pattern's loadout; the notice's Undo puts each back. */
async function bringAllUpToDate(pattern: MechPattern, behind: readonly Mech[]) {
  const before = behind.map((mech) => ({
    id: mech.id,
    loadout: { systems: [...mech.systems], modules: [...mech.modules] },
  }))
  await writeLoadouts(
    behind.map((mech) => ({
      id: mech.id,
      loadout: { systems: [...pattern.systems], modules: [...pattern.modules] },
    }))
  )
  const said =
    behind.length === 1
      ? mechCopy('broughtOneUpToDate', { name: behind[0]?.name ?? '', pattern: pattern.name })
      : mechCopy('broughtAllUpToDate', { count: behind.length, pattern: pattern.name })
  restoreToast(said, () => {
    void writeLoadouts(before).then(
      () => toast.success(mechCopy('loadoutsPutBack')),
      (err: unknown) => toast.error(failureMessage(err, mechCopy('loadoutsNotPutBack')))
    )
  })
}

export function PatternMechs({ pattern }: { pattern: MechPattern }) {
  const mechs = useUnits((s) => s.mechs)
  const { confirm, dialog } = useConfirm()
  const rows = patternMechs(pattern, mechs)
  if (rows.length === 0) return null
  const behind = rows.filter(isBehind)

  function ask() {
    confirm({
      title:
        behind.length === 1
          ? mechCopy('bringOneUpToDateTitle', { name: behind[0]?.mech.name ?? '' })
          : mechCopy('bringAllUpToDateTitle', { count: behind.length }),
      // What it will change, Mech by Mech, then what it keeps.
      body: [
        ...behind.map(({ mech, stamp }) =>
          mechCopy('bringUpToDateLine', { name: mech.name, differs: stamp?.differs ?? '' })
        ),
        mechCopy('bringUpToDateKeeps', { pattern: pattern.name }),
      ],
      confirmLabel: mechCopy('bringAllUpToDate'),
      pendingLabel: mechCopy('bringingUpToDate'),
      tone: 'default',
      failure: mechCopy('notBroughtUpToDate'),
      onConfirm: () =>
        bringAllUpToDate(
          pattern,
          behind.map((row) => row.mech)
        ),
    })
  }

  return (
    <>
      <Ledger
        label={buildShelvesCopy('mechsBuiltFromIt')}
        tone="mech"
        nameLabel={buildShelvesCopy('mechsBuiltFromIt')}
        count={rows.length}
        columns={COLUMNS}
        rows={rows.map((row) => ({
          id: row.mech.id,
          name: row.mech.name,
          href: `/mechs/${row.mech.id}`,
          ...(isBehind(row) && row.stamp?.differs ? { under: row.stamp.differs } : {}),
          cells: [
            row.stamp === undefined
              ? ''
              : isBehind(row)
                ? mechCopy('patternMechBehind')
                : mechCopy('patternMechUpToDate'),
          ],
        }))}
        action={
          behind.length > 0 ? (
            <Button size="compact" onClick={ask}>
              {mechCopy('bringAllUpToDate')}
            </Button>
          ) : undefined
        }
      />
      {dialog}
    </>
  )
}
