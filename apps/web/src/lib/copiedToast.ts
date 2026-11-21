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
import type { Confirm } from '../components/shared/useConfirm'
import { componentsCopy } from '../messages/components'
import { usePatterns } from '../replica/collections'
import { subscribe } from '../replica/replica'
import { useUnits } from '../replica/units'
import { failureMessage } from './connection/useServerAction'
import { copyForShelf, copyName, freeName, namesOn } from './copyEntity'
import { patternCopy, savedPatternHref } from './patterns/patterns'

/** How long an action toast stays: the Undo line's time (`changeUndoToast`). */
const ACTION_TOAST_MS = 8000

/** What a copy answers: its name, where it opens, and whether it is still there. */
type Made = { name: string; href: string; exists?: () => boolean; mech?: string }

/** Says a copy was made, with the way to it, for as long as there is a copy to open. */
function copiedToast(made: Made, go: (href: string) => void): void {
  let unwatch: (() => void) | undefined
  const said = made.mech
    ? componentsCopy('madeCopyWithMech', { name: made.name, mech: made.mech })
    : componentsCopy('madeCopy', { name: made.name })
  const id = toast.success(said, {
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

/** The units a copy reads and writes: the account's, unless a sheet hands its own. */
type Units = Pick<
  ReturnType<typeof useUnits.getState>,
  'create' | 'delete' | 'get' | 'list' | 'softLinks'
>

/** What a copy of a unit may bring and tell. */
type CopyOptions = {
  /** The pilot's mech, copied with it and paired to the copy. */
  mech?: { id: string; name: string }
  /** Told the copy's id once it is made, so its row can be brought into view. */
  landed?: (id: string) => void
  units?: Units
}

/** The mech a pilot flies, where these units hold it; else null. */
export function mechFlownBy(
  pilotId: string,
  units: Pick<Units, 'get' | 'softLinks'> = useUnits.getState()
): { id: string; name: string } | null {
  const link = units.softLinks.find((l) => l.type === 'mech-to-pilot' && l.to.id === pilotId)
  return link ? units.get('mech', link.from.id) : null
}

/** The name of the mech a pilot's delete leaves behind, for the confirm; else undefined. */
export const keptMech = (type: EntityKind, id: string, units?: Units): string | undefined =>
  type === 'pilot' ? mechFlownBy(id, units)?.name : undefined

/**
 * Copy one of your units onto the Training Bay, named "Copy of …", numbered
 * past the names taken. A pilot's copy takes a callsign of its own too
 * (`GHOST 2`): the list leads with the callsign, so two alike read as one
 * pilot. With `mech`, the pilot's mech is copied and paired with the copy, all
 * or nothing.
 */
export function copyUnit(
  type: EntityKind,
  name: string,
  body: Parameters<typeof copyForShelf>[0],
  go: Go,
  { mech, landed, units: given }: CopyOptions = {}
): Promise<void> {
  const units = given ?? useUnits.getState()
  return makeACopy({
    name,
    make: async () => {
      const copy = copyForShelf(body, name, namesOn(units.list(type)))
      if (type === 'pilot' && typeof copy.callsign === 'string')
        copy.callsign = freeName(
          copy.callsign,
          units.list('pilot').map((p) => p.callsign)
        )
      const created = await units.create(type, copy as never)
      let withMech: string | undefined
      const source = mech ? units.get('mech', mech.id) : null
      if (source) {
        let made: string | undefined
        try {
          const twin = await units.create(
            'mech',
            copyForShelf(source, source.name, namesOn(units.list('mech'))) as never
          )
          made = twin.id
          await units.create('softLink', {
            from: { type: 'mech', id: twin.id },
            to: { type: 'pilot', id: created.id },
            type: 'mech-to-pilot',
          })
          withMech = twin.name
        } catch (error) {
          if (made) await units.delete('mech', made)
          await units.delete(type, created.id)
          throw error
        }
      }
      landed?.(created.id)
      return {
        name: created.name,
        href: `/${type}s/${created.id}`,
        exists: () => (given ?? useUnits.getState()).get(type, created.id) !== null,
        ...(withMech ? { mech: withMech } : {}),
      }
    },
    go,
  })
}

/**
 * "Make a copy" of a unit. A pilot that flies a mech is asked once whether
 * the mech comes too (a Starter Set pilot's copy brings its mech, so yours may);
 * anything else is copied at once.
 */
export function copyAsking(
  confirm: Confirm,
  type: EntityKind,
  name: string,
  body: Parameters<typeof copyForShelf>[0],
  go: Go,
  options: Omit<CopyOptions, 'mech'> = {}
): Promise<void> {
  const id = typeof body.id === 'string' ? body.id : ''
  const mech = type === 'pilot' ? mechFlownBy(id, options.units) : null
  if (mech === null) return copyUnit(type, name, body, go, options)
  confirm({
    title: componentsCopy('copyTheMechToo'),
    body: [componentsCopy('pilotFliesMech', { name, mech: mech.name })],
    confirmLabel: componentsCopy('copyBoth'),
    pendingLabel: componentsCopy('copying'),
    tone: 'default',
    failure: componentsCopy('couldNotBeCopied', { name }),
    onConfirm: () => copyUnit(type, name, body, go, { ...options, mech }),
    alternate: {
      label: componentsCopy('pilotOnly'),
      onConfirm: () => copyUnit(type, name, body, go, options),
    },
  })
  return Promise.resolve()
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
