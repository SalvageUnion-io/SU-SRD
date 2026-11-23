/**
 * "Make a copy" without a confirm: a copy only adds, and deleting it is the
 * way back, so the act runs at once and says what it made. The notice opens
 * what was made and stays as any toast with an action does (chrome K5; r5 C3,
 * over r4 E19's standing line): its close takes it down, and it closes at once
 * when the copy is gone (deleted, or the account signed out), since its action
 * would then open nothing. Its words follow a rename (`said` as a function).
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
import { copyBeside, copyForShelf, copyName, freshMechCopy, namesOn } from './copyEntity'
import { patternCopy, savedPatternHref } from './patterns/patterns'

/** What a copy answers: its name, where it opens, whether it is still there, and the mech copied with it. */
type Made = { name: string; href: string; exists?: () => boolean; mech?: string }

/**
 * Says what an act made (`said`), with the way to it (`open`), for as long as
 * it is there to open or until the notice leaves. `said` as a function is
 * read again on every change to what the account holds, so the line names the
 * thing as it is called now (r5 C3).
 */
export function madeToast(
  said: string | (() => string),
  open: string,
  made: Pick<Made, 'href' | 'exists'>,
  go: (href: string) => void
): void {
  const words = typeof said === 'function' ? said : () => said
  let unwatch: (() => void) | undefined
  let shown = words()
  const options = {
    action: { label: open, onClick: () => go(made.href) },
    onDismiss: () => unwatch?.(),
    onAutoClose: () => unwatch?.(),
  }
  const id = toast.success(shown, options)
  const { exists } = made
  if (!exists && typeof said !== 'function') return
  unwatch = subscribe(() => {
    if (exists && !exists()) {
      unwatch?.()
      toast.dismiss(id)
      return
    }
    const now = words()
    if (now === shown) return
    shown = now
    toast.success(now, { ...options, id })
  })
}

/**
 * Says what was copied, by the original's name (`of`), with the way to the
 * copy; or, where the copy has opened already (`back`, r7 G4), the way back
 * to the original.
 */
function copiedToast(of: string, made: Made, go: (href: string) => void, back?: string): void {
  const said = made.mech
    ? componentsCopy('madeCopyWithMech', { name: of, mech: made.mech })
    : componentsCopy('madeCopy', { name: of })
  if (back === undefined) {
    madeToast(said, componentsCopy('openTheCopy'), made, go)
    return
  }
  go(made.href)
  madeToast(said, componentsCopy('backToTheOriginal'), { href: back }, go)
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
  /** The original's address: the copy opens at once and its notice leads back here (r7 G4). */
  back?: string | undefined
}): Promise<void> {
  try {
    copiedToast(args.name, await args.make(), args.go, args.back)
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
  /** Open the copy as it is made, its notice leading back to the original (r7 G4). */
  openCopy?: boolean
}

/** The mech a pilot flies, where these units hold it; else null. */
function mechFlownBy(
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
 * Copy one of your units onto the Training Bay (an NPC, into the Game its
 * original is in), its name numbered past the names taken (`Mara Voss 2`). A
 * pilot's copy takes a callsign of its own too
 * (`GHOST 2`): the list leads with the callsign, so two alike read as one
 * pilot. With `mech`, the pilot's mech is copied and paired with the copy, all
 * or nothing.
 */
function copyUnit(
  type: EntityKind,
  name: string,
  body: Parameters<typeof copyForShelf>[0],
  go: Go,
  { mech, landed, units: given, openCopy }: CopyOptions = {}
): Promise<void> {
  const units = given ?? useUnits.getState()
  const original = typeof body.id === 'string' ? body.id : undefined
  return makeACopy({
    name,
    back: openCopy && original ? `/${type}s/${original}` : undefined,
    make: async () => {
      // An NPC's copy stays in the Game its original is in (MD3-12).
      const taken = namesOn(units.list(type))
      const shelved =
        type === 'npc' ? copyBeside(body, name, taken) : copyForShelf(body, name, taken)
      const copy = type === 'mech' ? freshMechCopy(shelved) : shelved
      if (type === 'pilot' && typeof copy.callsign === 'string')
        copy.callsign = copyName(
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
            freshMechCopy(copyForShelf(source, source.name, namesOn(units.list('mech')))) as never
          )
          made = twin.id
          await units.create('softLink', {
            from: { type: 'mech', id: twin.id },
            to: { type: 'pilot', id: created.id },
            type: 'mech-to-pilot',
          })
          withMech = source.name
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

/** Copy a saved pattern beside the original; `landed` is told the copy. */
export function copyPattern(
  pattern: MechPattern,
  go: Go,
  landed?: (copy: MechPattern) => void
): Promise<void> {
  return makeACopy({
    name: pattern.name,
    make: async () => {
      const patterns = usePatterns.getState()
      const created = await patterns.create({
        ...patternCopy(pattern),
        name: copyName(pattern.name, namesOn(patterns.mechPatterns)),
      })
      landed?.(created)
      return {
        name: created.name,
        href: savedPatternHref(created.id),
        exists: () => usePatterns.getState().mechPatterns.some((held) => held.id === created.id),
      }
    },
    go,
  })
}
