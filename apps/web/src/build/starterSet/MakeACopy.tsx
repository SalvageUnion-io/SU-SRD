/**
 * "Make a copy" — the Starter Set sheet's one action: copy this build, to edit
 * and play. Signed in it is the page's own control at the sheet's size
 * (`CopyStarterMenu`): one confirm naming where the copy goes, a pilot with
 * their mech. The template is untouched (`copyStarter`).
 *
 * Signed out, the same button signs in first and comes back to this sheet: a
 * copy is a build of your own, and builds live in an account (ADR-034 as
 * amended). Offline it is absent, as every write is.
 *
 * Both states sit at the `full` rung: this is the sheet's one action, the band
 * carries nothing else, and `compact` drew a 30px target under the 44px floor
 * (ruleset §4.6).
 */

import type { SheetKind } from 'game-domain/entityKinds'
import type { Confirm } from '../../components/shared/useConfirm'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
import { useSync } from '../../replica/syncContext'
import { SignInControl } from '../account/SignInControl'
import { CopyStarterMenu } from './CopyStarterMenu'

type MakeACopyProps = {
  kind: SheetKind
  templateId: string
  name: string
  /** Opens the confirm. Owned by an ancestor that outlives the control. */
  confirm: Confirm
}

export function MakeACopy({ kind, templateId, name, confirm }: MakeACopyProps) {
  const { status } = useSync()

  if (status === 'signedOut') {
    return (
      <SignInControl
        label={buildStarterSetCopy('signInToMakeA')}
        redirectTo={`/starter/${kind}/${templateId}`}
        size="full"
        className="su-page-action"
      />
    )
  }
  return (
    <CopyStarterMenu
      kind={kind}
      templateId={templateId}
      name={name}
      confirm={confirm}
      size="full"
      className="su-page-action"
    />
  )
}
