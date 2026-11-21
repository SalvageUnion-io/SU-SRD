/**
 * "Make a copy" without a confirm: a copy only adds, and deleting it is the
 * way back, so the act runs at once and says what it made. The notice stays
 * until it is answered (a copy you cannot find is no copy), and its one action
 * opens the copy.
 */

import type { EntityKind } from 'game-domain/entityKinds'
import type { MechPattern } from 'game-domain/schemas/pattern'
import { toast } from '../components/index'
import { componentsCopy } from '../messages/components'
import { usePatterns } from '../replica/collections'
import { useUnits } from '../replica/units'
import { failureMessage } from './connection/useServerAction'
import { copyForShelf, copyName, namesOn } from './copyEntity'
import { patternCopy, savedPatternHref } from './patterns/patterns'

/** Says a copy was made, until dismissed, with the way to it. */
function copiedToast(text: string, open: () => void): void {
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
      return { name: created.name, href: `/${type}s/${created.id}` }
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
      return { name: created.name, href: savedPatternHref(created.id) }
    },
    go,
  })
}
