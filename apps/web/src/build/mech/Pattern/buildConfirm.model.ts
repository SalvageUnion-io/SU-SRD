/**
 * What every Build With This says once it has built (r4 E23, over r2 D4's
 * confirm): the build is one press, since what it makes is an ordinary mech,
 * and the notice carries the way back. It names the mech, warns where the
 * build is past the starting rules, and its Undo deletes the mech again.
 */

import { toast } from '../../../components/index'
import { failureMessage } from '../../../lib/connection/useServerAction'
import { namesOn } from '../../../lib/copyEntity'
import { mechCopy } from '../../../messages/build-mech'
import { useUnits } from '../../../replica/units'

/** How long the notice and its Undo stay: the Undo line's time (`changeUndoToast`). */
const UNDO_MS = 8000

/** The names of the mechs in the bay now: a build under one of them is numbered. */
export const mechNamesTaken = (): string[] => namesOn(useUnits.getState().list('mech'))

/** Take a just-built mech away again, and step back off its sheet where the build opened it. */
export async function undoBuild(mech: { id: string; name: string }): Promise<void> {
  try {
    await useUnits.getState().delete('mech', mech.id)
    toast.success(mechCopy('buildUndone', { name: mech.name }))
    if (typeof window !== 'undefined' && window.location.pathname.endsWith(`/mechs/${mech.id}`))
      window.history.back()
  } catch (err) {
    toast.error(failureMessage(err, mechCopy('buildNotUndone', { name: mech.name })))
  }
}

/**
 * Says what a build made, as the page lands on it, with its Undo. `past`: the
 * loadout exceeds the starting rules, which the notice says in a second line.
 */
export function builtToast(mech: { id: string; name: string }, past = false): void {
  toast.success(mechCopy('builtFromThePattern', { name: mech.name }), {
    duration: UNDO_MS,
    ...(past ? { description: mechCopy('pastTheStartingRules') } : {}),
    action: { label: mechCopy('undo'), onClick: () => void undoBuild(mech) },
  })
}

/**
 * What deleting a pattern says of the mechs built from it (r3 G3): how many
 * of the maker's own there are and that they keep their loadout, then that
 * the pattern's page goes with it.
 */
export function deletePatternLines(patternId: string): string[] {
  const built = useUnits
    .getState()
    .list('mech')
    .filter((mech) => mech.sourcePattern === patternId).length
  return [
    ...(built === 0
      ? []
      : [
          built === 1
            ? mechCopy('oneMechBuiltFromIt')
            : mechCopy('mechsBuiltFromIt', { count: built }),
        ]),
    mechCopy('patternPageGoes'),
  ]
}

/** Whether a saved pattern already wears this name, however it is cased or spaced (r4 E13). */
export function patternNameTaken(name: string, held: readonly { name: string }[]): boolean {
  const wanted = name.trim().toLowerCase()
  return wanted !== '' && held.some((pattern) => pattern.name.trim().toLowerCase() === wanted)
}
