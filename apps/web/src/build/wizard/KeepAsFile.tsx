/**
 * KeepAsFile — what a signed-out builder can keep without an account: the
 * build as a file (`draftExportBundle`, which the Training Bay's Backups
 * reads back) and on paper. At the head of the Review step, and beside the
 * sign-in ask Save raises (`SaveSignInDialog`).
 *
 * Download hands over a data file, so it says so (r3 E2): what the file is
 * called, that it is not a sheet to read, where it loads, and that it came.
 */

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button, Text, tokens } from '../../components/index'
import { buildWizardCopy } from '../../messages/build-wizard'

export type KeepAsFileActs = {
  /** The file Download saves: `salvageunion-pilot-mara-voss.json`. */
  fileName: string
  /** Saves the file; false where the build is not yet valid and nothing came. */
  onDownload: () => boolean
  onPrint: () => void
}

const STACK = { display: 'grid', gap: tokens.space[6] } satisfies CSSProperties

const ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

export function KeepAsFile({ fileName, onDownload, onPrint }: KeepAsFileActs) {
  // The file that came, by name: a rename afterwards is a new file to fetch.
  const [downloaded, setDownloaded] = useState<string | null>(null)
  return (
    <div style={STACK}>
      <div style={ROW}>
        <Text variant="note">{buildWizardCopy('keepWithoutAnAccount')}</Text>
        <Button
          size="compact"
          onClick={() => {
            if (onDownload()) setDownloaded(fileName)
          }}
        >
          {buildWizardCopy('download')}
        </Button>
        <Button size="compact" onClick={onPrint}>
          {buildWizardCopy('print')}
        </Button>
      </div>
      <Text variant="note">{buildWizardCopy('downloadIsADataFile', { file: fileName })}</Text>
      <Text variant="note" role="status">
        {downloaded === null ? '' : buildWizardCopy('downloadedFile', { file: downloaded })}
      </Text>
    </div>
  )
}
