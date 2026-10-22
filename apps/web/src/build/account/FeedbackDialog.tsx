import { useMutation } from 'convex/react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import {
  ConfirmDialog,
  InlineRef,
  Segmented,
  SegmentedOption,
  Stack,
  Textarea,
  toast,
  tokens,
} from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'

/**
 * "Suggest or report" (ADR-054): a player's note, filed as a labelled issue on
 * the public SU-SRD repository with no name on it (`convex/feedback.ts`). The
 * dialog says so above the box, before anybody types.
 *
 * It is the house confirm (`ConfirmDialog`) with the note as its body: one
 * pending state, one failure line, one Cancel, rather than a second dialog
 * kind for a two-field form.
 */

type Kind = 'suggestion' | 'report'

/** The bounds the server holds a note to (`FEEDBACK_MIN`, `FEEDBACK_MAX`). */
const MIN = 10
const MAX = 2000

const ISSUES_URL = 'https://github.com/SalvageUnion-io/SU-SRD/issues'

const NOTE = { margin: 0 } satisfies CSSProperties

const BOX = { width: '100%' } satisfies CSSProperties

const COUNT = {
  margin: 0,
  fontSize: tokens.fontSize.xs,
  textAlign: 'right',
} satisfies CSSProperties

type FeedbackDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const submit = useMutation(api.feedback.submit)
  const [kind, setKind] = useState<Kind>('suggestion')
  const [text, setText] = useState('')
  const length = text.trim().length

  async function send() {
    if (length < MIN) throw new Error('short')
    await submit({ kind, text, page: window.location.pathname })
    setText('')
    toast.success('Thank you! Your note is on its way to the workshop.')
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Suggest or report"
      confirmLabel="Send"
      pendingLabel="Sending…"
      onConfirm={send}
      describeError={(err) =>
        length < MIN
          ? `Say a little more: at least ${MIN} characters.`
          : failureMessage(err, 'Your note could not be sent. Try again.')
      }
      body={
        <Stack gap={12}>
          <p style={NOTE}>
            Your note becomes a public{' '}
            <InlineRef href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
              GitHub issue
            </InlineRef>
            , without your name. Please leave out anything private.
          </p>
          <Segmented label="Kind of note" size="compact">
            <SegmentedOption pressed={kind === 'suggestion'} onClick={() => setKind('suggestion')}>
              Suggestion
            </SegmentedOption>
            <SegmentedOption pressed={kind === 'report'} onClick={() => setKind('report')}>
              Report a problem
            </SegmentedOption>
          </Segmented>
          <Textarea
            aria-label={kind === 'report' ? 'What went wrong, and where' : 'Your idea'}
            placeholder={
              kind === 'report' ? 'What went wrong, and on which page?' : 'What would you like?'
            }
            rows={6}
            maxLength={MAX}
            style={BOX}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p style={COUNT} aria-live="polite">
            {length} / {MAX}
          </p>
        </Stack>
      }
    />
  )
}
