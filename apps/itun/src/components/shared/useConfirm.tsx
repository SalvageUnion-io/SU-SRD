import { ConfirmDialog } from 'component-lib'
import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'
import { serverMessage } from '../../lib/connection/serverError'
import type { ConfirmCopy } from '../../lib/games/rowActionCopy'
import { captureException } from '../../lib/observability'

/**
 * One confirm dialog for a whole surface, opened imperatively.
 *
 * `confirm(request)` opens the shared `ConfirmDialog` with the request's copy
 * and runs `onConfirm` only when the player confirms; `dialog` is the element
 * to render. A surface with many rows and many verbs — the Game roster —
 * renders one dialog instead of one per verb, and the copy comes from
 * `lib/games/rowActionCopy.ts` rather than being re-worded at each call site.
 *
 * ## Render `dialog` where it will outlive the control that asked
 *
 * The dialog is the hook owner's, not the button's. That matters wherever the
 * button sits in something that unmounts on an outside click — the live
 * sheet's ⋯ menu does, and the dialog is portalled outside it, so a confirm
 * rendered inside the menu would be torn down by the very press that answers
 * it. The sheet therefore owns the hook and hands `confirm` down.
 *
 * ## Failures
 *
 * A rejection keeps the dialog open with a reason (see `ConfirmDialog`), and
 * the reason follows the app's rule for errors: a server refusal shows the
 * words the server chose for the player; anything else shows the request's
 * own `failure` line and is reported, because it is a defect rather than the
 * system working.
 */

export type ConfirmRequest = ConfirmCopy & {
  /** The action. Runs only on confirm; a rejection keeps the dialog open. */
  onConfirm: () => void | Promise<void>
}

export type Confirm = (request: ConfirmRequest) => void

/**
 * What to tell the player when an action fails.
 *
 * A refusal (`ConvexError`) carries wording the server chose for the player.
 * Anything else does not — a redacted server error reads
 * `[CONVEX M(fn)] … Server Error` — so it gets `fallback` and a report.
 */
export function failureMessage(err: unknown, fallback: string): string {
  const refusal = serverMessage(err)
  if (refusal !== null) return refusal
  captureException(err)
  return fallback
}

export function useConfirm(): { confirm: Confirm; dialog: ReactNode } {
  // The request outlives `open`, so the dialog keeps its words while it closes
  // instead of flashing an empty title.
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const [open, setOpen] = useState(false)

  const confirm = useCallback<Confirm>((next) => {
    setRequest(next)
    setOpen(true)
  }, [])

  const dialog =
    request === null ? null : (
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={request.title}
        body={request.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        confirmLabel={request.confirmLabel}
        pendingLabel={request.pendingLabel}
        tone={request.tone}
        onConfirm={request.onConfirm}
        describeError={(err) => failureMessage(err, request.failure)}
      />
    )

  return { confirm, dialog }
}
