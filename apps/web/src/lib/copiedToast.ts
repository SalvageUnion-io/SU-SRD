/**
 * "Make a copy" without a confirm: a copy only adds, and deleting it is the
 * way back, so the act runs at once and says what it made. The notice is an
 * action toast like any other: it leaves on its timer, its one action opens
 * the copy, and it closes at once when the copy is gone (deleted, or the
 * account signed out), since its action would then open nothing.
 */

import type { EntityKind } from 'game-domain/entityKinds'
import type { MechPattern } from 'game-domain/schemas/pattern'
import { toast } from '../components/index'
import { componentsCopy } from '../messages/components'
import { usePatterns } from '../replica/collections'
import { subscribe } from '../replica/replica'
import { useUnits } from '../replica/units'
import { failureMessage } from './connection/useServerAction'
import { copyForShelf, copyName, namesOn } from './copyEntity'
import { patternCopy, savedPatternHref } from './patterns/patterns'

/** How long an action toast stays: the Undo line's time (`changeUndoToast`). */
const ACTION_TOAST_MS = 8000

/** What a copy answers: its name, where it opens, and whether it is still there. */
type Made = { name: string; href: string; exists?: () => boolean }

/** Says a copy was made, with the way to it, for as long as there is a copy to open. */
function copiedToast(made: Made, go: (href: string) => void): void {
  let unwatch: (() => void) | undefined
  const id = toast.success(componentsCopy('madeCopy', { name: made.name }), {
    duration: ACTION_TOAST_MS,
    action: { label: componentsCopy('openTheCopy'), onClick: () => go(made.href) },
    onDismiss: () => unwatch?.(),
    onAutoClose: () => unwatch?.(),
  })
  const { exists } = made
  if (!exists) return
  unwatch = subscribe(() => {
    if (exists()) return
    unwatch?.()
    toast.dismiss(id)
  })
}

/**
 * Make a copy now: `make` creates it and answers what it is called, where it
 * opens and whether it still exists; a refusal is a toast, as any failed act
 * is (chrome K8).
 */
export async function makeACopy(args: {
  /** What is being copied, for the failure line. */
  name: string
  make: () => Promise<Made>
  go: (href: string) => void
}): Promise<void> {
  try {
    copiedToast(await args.make(), args.go)
  } catch (err) {
    toast.error(failureMessage(err, componentsCopy('couldNotBeCopied', { name: args.name })))
  }
}

type Go = (href: string) => void

/** Copy one of your units onto the Training Bay, named "Copy of …", numbered past the names taken. */
export function copyUnit(
  type: EntityKind,
  name: string,
  body: Parameters<typeof copyForShelf>[0],
  go: Go
): Promise<void> {
  return makeACopy({
    name,
    make: async () => {
      const units = useUnits.getState()
      const created = await units.create(
        type,
        copyForShelf(body, name, namesOn(units.list(type))) as never
      )
      return {
        name: created.name,
        href: `/${type}s/${created.id}`,
        exists: () => useUnits.getState().get(type, created.id) !== null,
      }
    },
    go,
  })
}

/** Copy a saved pattern beside the original. */
export function copyPattern(pattern: MechPattern, go: Go): Promise<void> {
  return makeACopy({
    name: pattern.name,
    make: async () => {
      const patterns = usePatterns.getState()
      const created = await patterns.create({
        ...patternCopy(pattern),
        name: copyName(pattern.name, namesOn(patterns.mechPatterns)),
      })
      return {
        name: created.name,
        href: savedPatternHref(created.id),
        exists: () => usePatterns.getState().mechPatterns.some((held) => held.id === created.id),
      }
    },
    go,
  })
}
