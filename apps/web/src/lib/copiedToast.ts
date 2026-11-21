/**
 * "Make a copy" without a confirm: a copy only adds, and deleting it is the
 * way back, so the act runs at once and says what it made. The notice stays
 * until it is answered (a copy you cannot find is no copy), and its one action
 * opens the copy.
 */

import { toast } from '../components/index'
import { componentsCopy } from '../messages/components'
import { failureMessage } from './connection/useServerAction'

/** Says a copy was made, until dismissed, with the way to it. */
export function copiedToast(text: string, open: () => void): void {
  toast.success(text, {
    duration: Number.POSITIVE_INFINITY,
    closeButton: true,
    action: { label: componentsCopy('openTheCopy'), onClick: open },
  })
}

/**
 * Make a copy now: `make` creates it and answers what it is called and where
 * it opens; a refusal is a toast, as any failed act is (chrome K8).
 */
export async function makeACopy(args: {
  /** What is being copied, for the failure line. */
  name: string
  make: () => Promise<{ name: string; href: string }>
  go: (href: string) => void
}): Promise<void> {
  try {
    const made = await args.make()
    copiedToast(componentsCopy('madeCopy', { name: made.name }), () => args.go(made.href))
  } catch (err) {
    toast.error(failureMessage(err, componentsCopy('couldNotBeCopied', { name: args.name })))
  }
}
