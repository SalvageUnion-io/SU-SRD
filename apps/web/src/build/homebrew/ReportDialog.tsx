/**
 * ReportDialog — a signed-in reader tells the site admins what is wrong with
 * one homebrew pattern (ADR-061): copied book text, something offensive,
 * spam. One report per reader; reporting again replaces the reason
 * (`homebrew.report`). The maker is not told who reported it.
 */

import { useState } from 'react'
import { ConfirmDialog, Field, Text, Textarea, toast } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { useHomebrewReport } from '../../lib/sharing/reads'
import { buildHomebrewCopy } from '../../messages/build-homebrew'

/** Mirrors `REPORT_REASON_MAX` in `worker/shared/homebrew.ts`. */
const REASON_MAX = 500

type ReportDialogProps = {
  appId: string
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReportDialog({ appId, name, open, onOpenChange }: ReportDialogProps) {
  const report = useHomebrewReport()
  const [reason, setReason] = useState('')
  const fieldId = `report-${appId}`

  async function send() {
    if (reason.trim() === '') throw new Error('empty')
    await report({ appId, reason })
    toast.success(buildHomebrewCopy('reportedThankYou', { name }))
    setReason('')
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={buildHomebrewCopy('reportTitle', { name })}
      body={
        <>
          <Text variant="hint">{buildHomebrewCopy('reportHint')}</Text>
          <Field label={buildHomebrewCopy('whatIsWrong')} htmlFor={fieldId}>
            <Textarea
              id={fieldId}
              value={reason}
              maxLength={REASON_MAX}
              onChange={(e) => setReason(e.target.value)}
              placeholder={buildHomebrewCopy('reasonPlaceholder')}
            />
          </Field>
        </>
      }
      confirmLabel={buildHomebrewCopy('report')}
      pendingLabel={buildHomebrewCopy('reporting')}
      tone="default"
      onConfirm={send}
      describeError={(err) =>
        err instanceof Error && err.message === 'empty'
          ? buildHomebrewCopy('sayWhatIsWrong')
          : failureMessage(err, buildHomebrewCopy('reportFailed'))
      }
    />
  )
}
