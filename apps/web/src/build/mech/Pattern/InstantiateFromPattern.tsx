/**
 * InstantiateFromPattern — creates a fresh Mech from a MechPattern.
 *
 * The new mech is `mechFromPattern`'s: the pattern's chassis and
 * loadout under the pattern's name, full SP/EP from the chassis, Heat 0, an
 * empty hold — a mech built from a pattern starts fresh — and the pattern it
 * came from in `sourcePattern`, which the pattern page counts. The db
 * layer gives it a fresh id and timestamps.
 *
 * Enforcement regime: NONE, deliberately —
 * instantiate is a Blank-family shortcut and its write path is untouched.
 * It adds PRESENTATION only: one press builds (r4 E23), and the notice says
 * what was built, offers Undo, and warns where the loadout is past the
 * starting rules (`pastStartingRules`, counted from the loadout: a saved
 * pattern stores no `legalStarting` tag). A name already in the bay is numbered.
 *
 * Drawn as a Mini action chip in the pattern Compact's last slot (C8, hard rule
 * C8); a failure is the act's toast, never a line under the Compact.
 */

import { moveTo } from 'game-domain/container'
import type { MechPattern } from 'game-domain/schemas/pattern'
import { Button } from '../../../components/index'
import { useServerAction } from '../../../lib/connection/useServerAction'
import { mechFromPattern, pastStartingRules } from '../../../lib/patterns/patterns'
import { mechCopy } from '../../../messages/build-mech'
import { useUnits } from '../../../replica/units'
import { builtToast, mechNamesTaken } from './buildConfirm.model'

type InstantiateFromPatternProps = {
  pattern: MechPattern
  /** Called with the new mech id after entityStore.create resolves. */
  onSuccess: (mechId: string) => void
  /** The Game the mech is built into (a wizard started for one); unset, the store decides. */
  gameId?: string | undefined
}

export function InstantiateFromPattern({
  pattern,
  onSuccess,
  gameId,
}: InstantiateFromPatternProps) {
  const build = useServerAction(
    () =>
      useUnits.getState().create('mech', {
        ...mechFromPattern(pattern, mechNamesTaken()),
        ...(gameId === undefined ? {} : moveTo({ kind: 'game', gameId })),
      }),
    {
      failure: mechCopy('mechNotBuiltFromPattern'),
      toastId: `build-from-pattern-${pattern.id}`,
    }
  )
  const { pending: isInstantiating } = build

  async function handleInstantiate() {
    const result = await build.run()
    if (!result.ok) return
    builtToast(result.value, pastStartingRules(pattern))
    onSuccess(result.value.id)
  }

  return (
    <Button
      type="button"
      size="mini"
      onClick={() => void handleInstantiate()}
      disabled={isInstantiating}
      // "Build With This", as every build action reads; the accessible name
      // starts with it and says what it builds.
      aria-label={mechCopy('buildWithThisAMech', { name: pattern.name })}
    >
      {isInstantiating ? mechCopy('building') : mechCopy('buildWithThis')}
    </Button>
  )
}
