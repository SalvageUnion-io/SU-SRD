/**
 * PublicMechBuild — a shared mech's way to a build of your own (r4 E18), as a
 * shared pattern's page has: signed out, "Sign in to build from this", coming
 * back to this page; signed in, "Build from this" makes a fresh mech on the
 * same chassis and loadout in your Training Bay and opens it. Damage, Heat and
 * cargo stay on the mech it was read from.
 */

import type { Mech } from 'game-domain/schemas/mech'
import { Button, toast } from '../../components/index'
import { useGo } from '../../components/shared/useGo'
import { useServerAction } from '../../lib/connection/useServerAction'
import { mechFromPattern } from '../../lib/patterns/patterns'
import { mechCopy } from '../../messages/build-mech'
import { useSync } from '../../replica/syncContext'
import { useUnits } from '../../replica/units'
import { SignInControl } from '../account/SignInControl'
import { mechNamesTaken } from '../mech/Pattern/buildConfirm.model'

type Build = Pick<Mech, 'id' | 'name' | 'chassisRef' | 'systems' | 'modules'>

export function PublicMechBuild({ mech }: { mech: Build }) {
  const { status, canWrite } = useSync()
  const go = useGo()
  const build = useServerAction(
    async () => {
      // A mech's build, not a pattern's: it records no source pattern.
      const { sourcePattern: _none, ...input } = mechFromPattern(
        { ...mech, schemaVersion: 1, createdAt: '' },
        mechNamesTaken()
      )
      return useUnits.getState().create('mech', input)
    },
    { failure: mechCopy('theMechCouldNotBe2'), toastId: 'public-mech-build' }
  )

  if (status === 'signedOut') {
    return <SignInControl label={mechCopy('signInToBuildFromThis')} returnHere />
  }
  if (status !== 'live' || !canWrite) return null
  return (
    <Button
      variant="primary"
      size="compact"
      disabled={build.pending}
      onClick={async () => {
        const result = await build.run()
        if (!result.ok) return
        toast.success(mechCopy('builtFromThisMech', { name: result.value.name }))
        go(`/mechs/${result.value.id}`)
      }}
    >
      {build.pending ? mechCopy('building') : mechCopy('buildFromThis')}
    </Button>
  )
}
