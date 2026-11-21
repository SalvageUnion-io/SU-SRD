/**
 * SaveSignInDialog — a guided wizard runs signed out; saving is where an
 * account is asked for (ADR-034 as amended). The build stays this tab's
 * session draft (`wizardDraft.ts`), so the Discord round trip lands back on
 * this step with every pick in place, and Save then lands it.
 */

import { DialogActions } from '../../components/app'
import { Button, ModalShell, Text } from '../../components/index'
import { routeInApp } from '../../lib/appBase'
import { buildWizardCopy } from '../../messages/build-wizard'
import { SignInControl } from '../account/SignInControl'
import { dialogBodyStyle } from './wizardStyles.model'

/** This page as a route in the app, query and all: where signing in returns. */
function hereInApp(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const route = routeInApp(window.location.pathname)
  return route === null ? undefined : `${route}${window.location.search}`
}

export function SaveSignInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
        <Text variant="body">{buildWizardCopy('yourBuildIsKeptAsADraft')}</Text>
        <DialogActions>
          <Button variant="ghost" size="compact" onClick={onClose}>
            {buildWizardCopy('keepEditing')}
          </Button>
          <SignInControl redirectTo={hereInApp()} />
        </DialogActions>
      </div>
    </ModalShell>
  )
}
