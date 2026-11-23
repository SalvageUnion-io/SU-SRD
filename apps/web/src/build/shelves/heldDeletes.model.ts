/**
 * A pattern's delete, held while its notice shows (r6 E3): the shelf drops it
 * at once and the notice carries Undo, but nothing is written until the notice
 * goes (it closes, times out, or the page is left). Undo before then simply
 * keeps it, so its shared links never stopped working. Several held at once
 * (a bulk delete) share one notice and one Undo.
 */
import { create } from 'zustand'
import { toast } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { buildShelvesCopy } from '../../messages/build-shelves'

type Held = { held: ReadonlySet<string> }

/** The ids whose delete is held: the shelf leaves them out. */
export const useHeldDeletes = create<Held>(() => ({ held: new Set() }))

const setHeld = (ids: readonly string[], on: boolean) =>
  useHeldDeletes.setState(({ held }) => {
    const next = new Set(held)
    for (const id of ids) {
      if (on) next.add(id)
      else next.delete(id)
    }
    return { held: next }
  })

/** What leaving the page writes: every delete still held. */
const pending = new Map<string, () => Promise<void>>()

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    for (const run of pending.values()) void run()
    pending.clear()
  })
}

/**
 * Hold the delete of `ids`, saying `message` with Undo; `commit` writes one
 * delete once the notice has gone. `failed` names what could not be deleted.
 */
export function holdDelete(
  ids: readonly string[],
  message: string,
  commit: (id: string) => Promise<void>,
  failed: (id: string) => string
): void {
  setHeld(ids, true)
  let settled = false
  const write = async () => {
    if (settled) return
    settled = true
    for (const id of ids) pending.delete(id)
    for (const id of ids) {
      try {
        await commit(id)
      } catch (err) {
        toast.error(failureMessage(err, failed(id)))
      } finally {
        setHeld([id], false)
      }
    }
  }
  for (const id of ids) pending.set(id, write)
  toast.success(message, {
    action: {
      label: buildShelvesCopy('undo'),
      onClick: () => {
        settled = true
        for (const id of ids) pending.delete(id)
        setHeld(ids, false)
      },
    },
    onDismiss: () => void write(),
    onAutoClose: () => void write(),
  })
}
