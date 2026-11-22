/**
 * What every Build With This says once it has built (r4 E23, over r2 D4's
 * confirm): the build is one press, since what it makes is an ordinary mech,
 * and the notice carries the way back. It names the mech, warns where the
 * build is past the starting rules, and its Undo deletes the mech again.
 */

import { toast } from '../../../components/index'
import { focusHeadingOnArrival } from '../../../lib/arrivalFocus'
import { failureMessage } from '../../../lib/connection/useServerAction'
import { refreshWorkerReads } from '../../../lib/connection/workerRead'
import { namesOn } from '../../../lib/copyEntity'
import { sharedPaths } from '../../../lib/sharing/paths'
import { mechCopy } from '../../../messages/build-mech'
import { usePatterns } from '../../../replica/collections'
import { useUnits } from '../../../replica/units'

/** How long the notice and its Undo stay: the Undo line's time (`changeUndoToast`). */
const UNDO_MS = 8000

/** How long a notice whose Undo brings back something replaced or deleted stays (r5 C3's 20 seconds). */
const RESTORE_MS = 20_000

/** A notice whose Undo brings back what was replaced or deleted (r5 D1, D9), for its 20 seconds. */
export function restoreToast(message: string, undo: () => void): void {
  toast.success(message, {
    duration: RESTORE_MS,
    action: { label: mechCopy('undo'), onClick: undo },
  })
}

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
  // The page it lands on takes focus on its heading (r6 F7).
  focusHeadingOnArrival()
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

/**
 * The pattern a save under a taken name may replace (r5 D1): the one of that
 * name the mech was built from, else the only one of that name. Two of a name
 * and neither the mech's own: none, since the press could not say which.
 */
export function patternToReplace<T extends { id: string; name: string }>(
  name: string,
  held: readonly T[],
  builtFrom: string | undefined
): T | undefined {
  const wanted = name.trim().toLowerCase()
  if (wanted === '') return undefined
  const named = held.filter((pattern) => pattern.name.trim().toLowerCase() === wanted)
  return (
    named.find((pattern) => pattern.id === builtFrom) ?? (named.length === 1 ? named[0] : undefined)
  )
}

type Build = { chassisRef: string; systems: readonly string[]; modules: readonly string[] }

async function writeBuild(id: string, build: Build): Promise<void> {
  await usePatterns.getState().update(id, {
    chassisRef: build.chassisRef,
    systems: [...build.systems],
    modules: [...build.modules],
  })
  void refreshWorkerReads(sharedPaths.sheet('pattern', id))
}

/**
 * Write a mech's build over a saved pattern (r5 D1): the pattern keeps its id
 * (so its link), its name, description and picture; the mechs built from it
 * keep their loadouts. The notice's Undo puts the old build back.
 */
export async function replacePattern(id: string, build: Build): Promise<void> {
  const before = usePatterns.getState().mechPatterns.find((pattern) => pattern.id === id)
  if (!before) throw new Error(mechCopy('patternNotReplaced'))
  await writeBuild(id, build)
  const { name } = before
  toast.success(mechCopy('replacedPattern', { name }), {
    duration: RESTORE_MS,
    action: {
      label: mechCopy('undo'),
      onClick: () =>
        void writeBuild(id, before).then(
          () => toast.success(mechCopy('patternPutBack', { name })),
          (err: unknown) =>
            toast.error(failureMessage(err, mechCopy('patternNotPutBack', { name })))
        ),
    },
  })
}
