/**
 * ReportDialog — a signed-in reader tells the site admins what is wrong with
 * one Homebrew library listing (ADR-056): copied book text, something
 * offensive, spam. One report per reader; reporting again replaces the
 * reason (`library.report`). The maker is not told who reported it.
 */

import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { ConfirmDialog, Field, Text, Textarea, toast } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import type { LibraryKind } from '../../lib/library/library'

/** Mirrors `REPORT_REASON_MAX` in `convex/library.ts`. */
const REASON_MAX = 500

type ReportDialogProps = {
  kind: LibraryKind
  appId: string
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReportDialog({ kind, appId, name, open, onOpenChange }: ReportDialogProps) {
  const report = useMutation(api.library.report)
  const [reason, setReason] = useState('')
  const fieldId = `report-${kind}-${appId}`

  async function send() {
    if (reason.trim() === '') throw new Error('empty')
    await report({ kind, appId, reason })
    toast.success(`Reported ${name}. Thank you.`)
    setReason('')
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Report ${name}?`}
      body={
        <>
          <Text variant="hint">
            A site admin reads every report and can take it out of the Homebrew library. Its maker
            is not told who reported it.
          </Text>
          <Field label="What is wrong with it" htmlFor={fieldId}>
            <Textarea
              id={fieldId}
              value={reason}
              maxLength={REASON_MAX}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Copied book text, offensive, spam…"
            />
          </Field>
        </>
      }
      confirmLabel="Report"
      pendingLabel="Reporting…"
      tone="default"
      onConfirm={send}
      describeError={(err) =>
        err instanceof Error && err.message === 'empty'
          ? 'Say what is wrong with it first.'
          : failureMessage(err, 'The report did not go through. Try again.')
      }
    />
  )
}
