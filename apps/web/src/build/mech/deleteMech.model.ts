/**
 * Deleting a Mech of the Training Bay (r5 D9, r6 E3): no confirm, a notice
 * whose Undo brings back the same Mech, under its own id with its loadout,
 * damage and links (its Pilot and its crawler), not a copy. Several deleted at
 * once (the shelf's Select) share one notice and one Undo.
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { toast } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { mechCopy } from '../../messages/build-mech'
import { useUnits } from '../../replica/units'
import { restoreToast } from './Pattern/buildConfirm.model'

/** Send the Mech back, then draw its links again; `quiet` leaves the notice to the caller. */
export async function putBack(mech: Mech, links: SoftLink[], quiet = false): Promise<boolean> {
  const units = useUnits.getState()
  try {
    await units.restore('mech', mech)
    for (const { id: _id, createdAt: _at, ...link } of links) await units.create('softLink', link)
    if (!quiet) toast.success(mechCopy('mechPutBack', { name: mech.name }))
    return true
  } catch (err) {
    toast.error(failureMessage(err, mechCopy('mechNotPutBack', { name: mech.name })))
    return false
  }
}

/** Delete the Mech, and say so with the Undo. Throws as `delete` does. */
export async function deleteMech(id: string): Promise<void> {
  await deleteMechs([id])
}

/**
 * Delete these Mechs, then one notice with one Undo for all of them. Throws on
 * the first that fails, after the notice for those already gone.
 */
export async function deleteMechs(ids: readonly string[]): Promise<void> {
  const units = useUnits.getState()
  const gone: { record: Mech; links: SoftLink[] }[] = []
  let failure: unknown
  for (const id of ids) {
    const record = units.get('mech', id)
    if (record === null) continue
    const links = units.list('softLink').filter((l) => l.from.id === id || l.to.id === id)
    try {
      await units.delete('mech', id)
      gone.push({ record, links })
    } catch (err) {
      failure = err
      break
    }
  }
  const [only] = gone
  if (only !== undefined)
    restoreToast(
      gone.length === 1
        ? mechCopy('mechDeleted', { name: only.record.name })
        : mechCopy('mechsDeleted', { count: String(gone.length) }),
      () =>
        void (async () => {
          if (gone.length === 1) {
            await putBack(only.record, only.links)
            return
          }
          let back = 0
          for (const { record, links } of gone) if (await putBack(record, links, true)) back += 1
          if (back > 0) toast.success(mechCopy('mechsPutBack', { count: String(back) }))
        })()
    )
  if (failure !== undefined) throw failure
}
