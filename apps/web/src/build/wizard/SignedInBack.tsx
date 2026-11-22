import { buildWizardCopy } from '../../messages/build-wizard'
import { signedInStyle } from './wizShellStyles.model'

/**
 * Back from the sign-in Save asked for, on the last step (r5 C14): one line
 * over the action bar that the Save is still to press, in its own words
 * ("Create Pilot", the CTA's label without its mark).
 */
export function SignedInBack({ submitLabel }: { submitLabel: string }) {
  return (
    <p role="status" style={signedInStyle}>
      {buildWizardCopy('signedInPressSave', { label: submitLabel.replace(/\s*✦$/, '') })}
    </p>
  )
}
