import { Dialog } from '@base-ui/react/dialog'
import type { CSSProperties, ReactNode } from 'react'
import { useRef, useState } from 'react'
import { color, font, fontSize, space } from '../../design/tokens'
import { Button } from '../chrome/Button'
import { FieldError } from '../chrome/FieldError'
import { ModalShell } from './ModalShell'

/**
 * ConfirmDialog — the one "are you sure?" between a player and an action they
 * cannot take back.
 *
 * Every confirm in the apps used to be hand-rolled from the same three parts —
 * a `ModalShell`, a muted paragraph, a ghost Cancel beside a coloured confirm —
 * and each copy had made its own choices about the parts that are easy to get
 * wrong: whether the buttons lock while the work runs, whether a failure keeps
 * the dialog open, where focus starts, and whether a screen reader is told it
 * is being asked something. This is those choices made once.
 *
 * - **An alert dialog.** `role="alertdialog"`, labelled by the title and
 *   described by the visible body, so the question is announced with its
 *   consequences. A backdrop click does not dismiss it; Escape and the header
 *   × cancel.
 * - **Focus starts on Cancel for `danger`**, so a stray Enter cancels instead
 *   of destroying. A constructive (`default`) confirm starts on the confirm
 *   button: there, Enter doing the thing is the point.
 * - **`onConfirm` may return a promise.** While it runs both buttons are
 *   disabled, the confirm shows `pendingLabel`, and nothing closes the dialog
 *   — closing mid-flight would read as done, or as cancelled, when it is
 *   neither yet. It closes itself (through `onOpenChange(false)`) once the
 *   promise resolves.
 * - **A failure stays on the dialog.** If `onConfirm` rejects, `describeError`
 *   turns the error into a line shown above the buttons and the dialog stays
 *   open, so the reader can retry or cancel knowing nothing happened. The
 *   default is a generic sentence and never the raw message: an error's
 *   `message` is written for a developer, and some (a redacted server error)
 *   are not fit to show at all. A caller with better words passes them.
 *
 * Styling is tokens in style objects (Tailwind-removal plan §4): nothing here
 * has a stateful variant, and the buttons bring their own `.su-btn` classes.
 */

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The question, naming what it acts on: "Delete Mira Cole?". */
  title: string
  /**
   * What will happen, and whether it can be undone. Rendered visibly and used
   * as the dialog's accessible description, so say it here rather than in an
   * sr-only restatement.
   */
  body: ReactNode
  /** The verb on the confirm button: "Delete", "Pick up". */
  confirmLabel: string
  /** The confirm button's label while `onConfirm` is in flight. */
  pendingLabel?: string
  cancelLabel?: string
  /**
   * `danger` for destructive confirms — rust header, danger button, focus on
   * Cancel. `default` for constructive ones — pilot-blue header, primary
   * button, focus on the confirm.
   */
  tone?: 'danger' | 'default'
  /** The action. A returned promise holds the dialog in its pending state. */
  onConfirm: () => void | Promise<void>
  /** Turn a rejection from `onConfirm` into the line the reader sees. */
  describeError?: (error: unknown) => ReactNode
}

const GENERIC_FAILURE = 'That did not work. Try again.'

const panelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  padding: space[20],
  backgroundColor: color.paper,
} satisfies CSSProperties

// The body's paragraphs sit on the panel's own 16px rhythm, which is the gap
// every hand-rolled confirm put between its paragraphs and its buttons.
const bodyStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  margin: 0,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  // `text-sm`'s paired line height. The hand-rolled confirms this replaces
  // got it from the utility; an inline font-size carries none of its own.
  lineHeight: '20px',
  color: color.wkMuted,
} satisfies CSSProperties

const actionsStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: space[8],
} satisfies CSSProperties

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  pendingLabel = 'Working…',
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  describeError = () => GENERIC_FAILURE,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ReactNode>(null)
  const [wasOpen, setWasOpen] = useState(open)
  // A second click can land before the disabled state renders; this is the
  // guard that does not wait for a render.
  const inFlight = useRef(false)
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const confirmRef = useRef<HTMLButtonElement | null>(null)

  // Every opening starts clean: an error from the last attempt is about that
  // attempt. Adjusted during render rather than in an effect, so the stale
  // line never paints for a frame first.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setError(null)
  }

  const danger = tone === 'danger'

  function handleOpenChange(next: boolean) {
    if (!next && inFlight.current) return
    onOpenChange(next)
  }

  async function handleConfirm() {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      // Explained, not dropped: the reason goes on the dialog, which stays
      // open so the reader can see that nothing happened.
      setError(describeError(err))
      return
    } finally {
      inFlight.current = false
      setPending(false)
    }
    onOpenChange(false)
  }

  return (
    <ModalShell
      role="alertdialog"
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={null}
      tone={danger ? 'danger' : 'action'}
      initialFocus={danger ? cancelRef : confirmRef}
    >
      <div style={panelStyle} aria-busy={pending || undefined}>
        <Dialog.Description render={<div />} style={bodyStyle}>
          {body}
        </Dialog.Description>
        <FieldError>{error}</FieldError>
        <div style={actionsStyle}>
          <Button
            ref={cancelRef}
            variant="ghost"
            size="compact"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={danger ? 'danger' : 'primary'}
            size="compact"
            disabled={pending}
            onClick={() => void handleConfirm()}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
