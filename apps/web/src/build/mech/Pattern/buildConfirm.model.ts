/**
 * The one confirm every Build With This asks (r2 D4): what it builds, in the
 * words of where the pattern is from, and a warning only for a build past the
 * starting rules. What it made is the toast after, on the new mech's sheet.
 */

import { toast } from '../../../components/index'
import { namesOn } from '../../../lib/copyEntity'
import { mechCopy } from '../../../messages/build-mech'
import { useUnits } from '../../../replica/units'

/** The confirm's body: `book` for a pattern the book prints, `past` when it exceeds the starting rules. */
export function buildConfirmBody({ book, past }: { book: boolean; past: boolean }): string {
  const builds = book ? mechCopy('buildsAsPrinted') : mechCopy('buildsAsSaved')
  return past ? `${mechCopy('pastTheStartingRules')} ${builds}` : builds
}

/** The names of the mechs in the bay now: a build under one of them is numbered. */
export const mechNamesTaken = (): string[] => namesOn(useUnits.getState().list('mech'))

/** Says what a build made, as the page lands on it. */
export function builtToast(name: string): void {
  toast.success(mechCopy('builtFromThePattern', { name }))
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
