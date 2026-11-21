/**
 * SaveSignInDialog — a guided wizard runs signed out; saving is where an
 * account is asked for (ADR-034 as amended). The build stays this tab's
 * session draft (`wizardDraft.ts`), so the Discord round trip lands back on
 * this step with every pick in place, and Save then lands it.
 *
 * Where nothing was edited (the pattern picker's Build With This, two picks
 * and no draft) it says so instead (`pick`): the choice is kept in the address
 * sign-in returns to, and there is nothing to keep editing.
 */

import { DialogActions } from '../../components/app'
import { Button, ModalShell, Text } from '../../components/index'
import { hereInApp } from '../../lib/hereInApp'
import { buildWizardCopy } from '../../messages/build-wizard'
import { SignInControl } from '../account/SignInControl'
import type { KeepAsFileActs } from './KeepAsFile'
import { KeepAsFile } from './KeepAsFile'
import { dialogBodyStyle } from './wizardStyles.model'

export function SaveSignInDialog({
  open,
  onClose,
  pick,
  keep,
}: {
  open: boolean
  onClose: () => void
  /**
   * No draft behind the ask, only a choice: the route in the app that carries
   * it (`/mechs/new?chassis=…&pattern=…`), where signing in returns.
   */
  pick?: string | undefined
  /** A finished build can be kept without an account: as a file, on paper. */
  keep?: KeepAsFileActs | undefined
}) {
  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={buildWizardCopy('signInToSave')}
      width="narrow"
    >
      <div style={dialogBodyStyle}>
        <Text variant="body">
          {pick === undefined
            ? buildWizardCopy('yourBuildIsKeptAsADraft')
            : buildWizardCopy('signInToBuildThis')}
        </Text>
        {keep && <KeepAsFile {...keep} />}
        <DialogActions>
          <Button variant="ghost" size="compact" onClick={onClose}>
            {pick === undefined ? buildWizardCopy('keepEditing') : buildWizardCopy('notNow')}
          </Button>
          <SignInControl redirectTo={pick ?? hereInApp()} />
        </DialogActions>
      </div>
    </ModalShell>
  )
}
