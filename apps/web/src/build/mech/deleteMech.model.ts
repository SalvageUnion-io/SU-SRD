/**
 * Deleting a Mech of the Training Bay (r5 D9): one confirm, then a notice
 * whose Undo brings back the same Mech, under its own id with its loadout,
 * damage and links (its Pilot and its crawler), not a copy.
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { toast } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { mechCopy } from '../../messages/build-mech'
import { useUnits } from '../../replica/units'
import { restoreToast } from './Pattern/buildConfirm.model'

/** Send the Mech back, then draw its links again. */
export async function putBack(mech: Mech, links: SoftLink[]) {
  const units = useUnits.getState()
  try {
    await units.restore('mech', mech)
    for (const { id: _id, createdAt: _at, ...link } of links) await units.create('softLink', link)
    toast.success(mechCopy('mechPutBack', { name: mech.name }))
  } catch (err) {
    toast.error(failureMessage(err, mechCopy('mechNotPutBack', { name: mech.name })))
  }
}

/** Delete the Mech, and say so with the Undo. Throws as `delete` does, for the confirm to show. */
export async function deleteMech(id: string): Promise<void> {
  const units = useUnits.getState()
  const record = units.get('mech', id)
  if (record === null) return
  const links = units.list('softLink').filter((l) => l.from.id === id || l.to.id === id)
  await units.delete('mech', id)
  restoreToast(mechCopy('mechDeleted', { name: record.name }), () => void putBack(record, links))
}
