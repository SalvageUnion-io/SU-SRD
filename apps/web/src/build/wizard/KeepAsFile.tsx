/**
 * KeepAsFile — what a signed-out builder can keep without an account: the
 * build as a file (`draftExportBundle`, which the Training Bay's Import…
 * reads back) and on paper. On the Review step, and beside the sign-in ask
 * Save raises (`SaveSignInDialog`).
 */

import type { CSSProperties } from 'react'
import { Button, Text, tokens } from '../../components/index'
import { buildWizardCopy } from '../../messages/build-wizard'

export type KeepAsFileActs = { onDownload: () => void; onPrint: () => void }

const ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

export function KeepAsFile({ onDownload, onPrint }: KeepAsFileActs) {
  return (
    // Chrome, not the build: paper leaves it out.
    <div data-print="hide" style={ROW}>
      <Text variant="note">{buildWizardCopy('keepWithoutAnAccount')}</Text>
      <Button size="compact" onClick={onDownload}>
        {buildWizardCopy('download')}
      </Button>
      <Button size="compact" onClick={onPrint}>
        {buildWizardCopy('print')}
      </Button>
    </div>
  )
}
