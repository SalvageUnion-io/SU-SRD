import type { CSSProperties } from 'react'
import { useState } from 'react'
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
import { useSubmitFeedback } from '../../lib/account/accountApi'
import { failureMessage } from '../../lib/connection/useServerAction'
import { buildAccountCopy } from '../../messages/build-account'

/**
 * "Suggest or report" (ADR-057): a player's note, filed as a labelled issue on
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
  const submit = useSubmitFeedback()
  const [kind, setKind] = useState<Kind>('suggestion')
  const [text, setText] = useState('')
  const length = text.trim().length

  async function send() {
    if (length < MIN) throw new Error('short')
    await submit({ kind, text, page: window.location.pathname })
    setText('')
    toast.success(buildAccountCopy('feedbackThanks'))
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={buildAccountCopy('suggestOrReport')}
      confirmLabel={buildAccountCopy('send')}
      pendingLabel={buildAccountCopy('sending')}
      onConfirm={send}
      describeError={(err) =>
        length < MIN
          ? buildAccountCopy('sayALittleMore', { min: MIN })
          : failureMessage(err, buildAccountCopy('yourNoteCouldNotBeSent'))
      }
      body={
        <Stack gap={12}>
          <p style={NOTE}>
            {buildAccountCopy('yourNoteBecomesAPublic')}{' '}
            <InlineRef href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
              {buildAccountCopy('githubIssue')}
            </InlineRef>
            {buildAccountCopy('withoutYourNamePlease')}
          </p>
          <Segmented label={buildAccountCopy('kindOfNote')} size="compact">
            <SegmentedOption pressed={kind === 'suggestion'} onClick={() => setKind('suggestion')}>
              {buildAccountCopy('suggestion')}
            </SegmentedOption>
            <SegmentedOption pressed={kind === 'report'} onClick={() => setKind('report')}>
              {buildAccountCopy('reportAProblem')}
            </SegmentedOption>
          </Segmented>
          <Textarea
            aria-label={
              kind === 'report'
                ? buildAccountCopy('whatWentWrongAndWhere')
                : buildAccountCopy('yourIdea')
            }
            placeholder={
              kind === 'report'
                ? buildAccountCopy('whatWentWrongAndOnWhichPage')
                : buildAccountCopy('whatWouldYouLike')
            }
            rows={6}
            maxLength={MAX}
            style={BOX}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p style={COUNT} aria-live="polite">
            {buildAccountCopy('noteLength', { length, max: MAX })}
          </p>
        </Stack>
      }
    />
  )
}
