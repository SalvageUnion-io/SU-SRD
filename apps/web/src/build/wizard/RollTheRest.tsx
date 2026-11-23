/**
 * RollTheRest — the Pilot wizard's identity step in one press (r7 F7): every
 * field still empty but the optional Name (r8 F1) is rolled on its table (`rollTheRest`), what is typed is
 * left as typed. Off once every field holds something.
 */

import type { CSSProperties } from 'react'
import { Button, tokens } from '../../components/index'
import { buildWizardCopy } from '../../messages/build-wizard'
import type { PilotIdentityField, RollTableDeps } from './rollTableHelpers.model'
import { ROLLED_BY_THE_REST, rollTheRest } from './rollTableHelpers.model'
import { tryNoteStyle } from './wizShellStyles.model'

const LINE = {
  ...tryNoteStyle,
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

type RollTheRestProps = {
  values: Record<PilotIdentityField, string>
  onRolled: (patch: Partial<Record<PilotIdentityField, string>>) => void
  /** Injectable deps for testing. */
  _rollDeps?: RollTableDeps
}

export function RollTheRest({ values, onRolled, _rollDeps }: RollTheRestProps) {
  const anyEmpty = ROLLED_BY_THE_REST.some((field) => values[field].trim() === '')
  return (
    <p style={LINE}>
      <Button
        size="compact"
        glyph="⚄"
        disabled={!anyEmpty}
        onClick={() => void rollTheRest(values, _rollDeps).then(onRolled)}
      >
        {buildWizardCopy('rollTheRest')}
      </Button>
      <span>{buildWizardCopy('rollTheRestHint')}</span>
    </p>
  )
}
