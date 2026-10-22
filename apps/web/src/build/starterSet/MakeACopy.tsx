/**
 * "Make a copy" — the Starter Set sheet's one action:
 * copy this build onto the player's shelf, to edit and play. The template is
 * untouched (`copyStarter`). Copying into a Game is the Starter Set page's
 * "Copy to…", which lists the destinations.
 *
 * Signed out, the same button signs in first and comes back to this sheet: a
 * copy is a build of your own, and builds live in an account (ADR-034 as
 * amended). Offline it is absent, as every write is.
 *
 * Both states sit at the `full` rung: this is the sheet's one action, the band
 * carries nothing else, and `compact` drew a 30px target under the 44px floor
 * (ruleset §4.6).
 */

import { SHELF } from 'game-domain/container'
import type { SheetKind } from 'game-domain/entityKinds'
import { Button, toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { useConnection } from '../../lib/connection/connectionContext'
import { copyStarter } from '../../lib/starterSet/copyStarter'
import { STARTER_SET_PUBLISHER } from '../../lib/starterSet/starterTemplates'
import { SignInControl } from '../account/SignInControl'

type MakeACopyProps = {
  kind: SheetKind
  templateId: string
  name: string
  /** Opens the confirm. Owned by an ancestor that outlives the control. */
  confirm: Confirm
}

export function MakeACopy({ kind, templateId, name, confirm }: MakeACopyProps) {
  const { mode } = useConnection()

  if (mode === 'solo') {
    return (
      <SignInControl
        label="Sign in to make a copy"
        redirectTo={`/starter/${kind}/${templateId}`}
        size="full"
        className="su-page-action"
      />
    )
  }
  if (mode !== 'connected') return null

  return (
    <Button
      variant="primary"
      size="full"
      className="su-page-action"
      onClick={() =>
        confirm({
          title: `Make a copy of ${name}?`,
          body: [
            `This puts a copy of ${name} in your Training Bay, a build of your own to edit and play.`,
            `The Starter Set's ${name} stays as ${STARTER_SET_PUBLISHER} published it.`,
          ],
          confirmLabel: 'Make a copy',
          pendingLabel: 'Copying…',
          tone: 'default',
          failure: `${name} could not be copied. Try again.`,
          onConfirm: async () => {
            await copyStarter(kind, templateId, SHELF)
            toast.success(`Copied ${name} to your Training Bay.`)
          },
        })
      }
    >
      Make a copy
    </Button>
  )
}
