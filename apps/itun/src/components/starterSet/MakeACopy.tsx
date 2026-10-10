/**
 * "Make a copy" — the Starter Set sheet's one action (board 10, issue 1255):
 * copy this build onto the player's shelf, to edit and play. The template is
 * untouched (`copyStarter`). Copying into a Game is the Starter Set page's
 * "Copy to…", which lists the destinations.
 *
 * Signed out, the same button signs in first and comes back to this sheet: a
 * copy is a build of your own, and builds live in an account (ADR-034 as
 * amended). Offline it is absent, as every write is.
 */

import { Button, toast } from 'component-lib'
import { useConnection } from '../../lib/connection/connectionContext'
import { SHELF } from '../../lib/container'
import type { StarterKind } from '../../lib/starterSet/copyStarter'
import { copyStarter, STARTER_SET_PUBLISHER } from '../../lib/starterSet/copyStarter'
import { SignInControl } from '../account/SignInControl'
import type { Confirm } from '../shared/useConfirm'

type MakeACopyProps = {
  kind: StarterKind
  templateId: string
  name: string
  /** Opens the confirm. Owned by an ancestor that outlives the control. */
  confirm: Confirm
}

export function MakeACopy({ kind, templateId, name, confirm }: MakeACopyProps) {
  const { mode } = useConnection()

  if (mode === 'solo') {
    return (
      <SignInControl label="Sign in to make a copy" redirectTo={`/starter/${kind}/${templateId}`} />
    )
  }
  if (mode !== 'connected') return null

  return (
    <Button
      variant="primary"
      size="compact"
      onClick={() =>
        confirm({
          title: `Make a copy of ${name}?`,
          body: [
            `This puts a copy of ${name} on your shelf, a build of your own to edit and play.`,
            `The Starter Set's ${name} stays as ${STARTER_SET_PUBLISHER} published it.`,
          ],
          confirmLabel: 'Make a copy',
          pendingLabel: 'Copying…',
          tone: 'default',
          failure: `${name} could not be copied. Try again.`,
          onConfirm: async () => {
            await copyStarter(kind, templateId, SHELF)
            toast.success(`Copied ${name} to your shelf.`)
          },
        })
      }
    >
      Make a copy
    </Button>
  )
}
