/**
 * deckActivation: an activation that spends nothing writes nothing and goes
 * straight on (`onPaid` at once), whether the action is the pilot's or a
 * companion's on its pilot host.
 */
import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { Pilot } from 'game-domain/schemas/pilot'
import { toast } from 'sonner'
import type { PlayAction } from '../../lib/rules/actionList'
import { payActivation } from '../deckActivation.model'
import { stubStore } from './stubStore'

const FREE = { epCost: 0, heat: 0, maxUses: 0 }

const pilot = {
  id: 'p1',
  name: 'Bonesaw',
  partners: [
    { id: 'pt-rex', hostRef: 'combat-drone', hostSchema: 'drones', systems: [], modules: [] },
  ],
} as unknown as Pilot

const action = (over: Partial<PlayAction> = {}): PlayAction =>
  ({ key: 'k', name: 'Hold Fast', slug: 'hold-fast', ...over }) as PlayAction

describe('an activation that spends nothing', () => {
  test("the pilot's: no AP write, and on at once", () => {
    const { store, calls } = stubStore(pilot)
    const onPaid = mock(() => {})
    payActivation({ store, pilot, mech: null, crawler: null }, action(), 'AP', FREE, onPaid)
    expect(onPaid).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([])
  })

  test("a companion's on its pilot: no write to the host, and on at once", () => {
    const { store, calls } = stubStore(pilot)
    const onPaid = mock(() => {})
    const companion = { id: 'pt-rex', name: 'Rex', host: { kind: 'pilot', id: 'p1' } } as const
    payActivation(
      { store, pilot, mech: null, crawler: null },
      action({ companion: companion as PlayAction['companion'] }),
      'EP',
      FREE,
      onPaid
    )
    expect(onPaid).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([])
  })

  test('a companion its host no longer holds pays nothing and stays put', () => {
    const { store, calls } = stubStore({ ...pilot, partners: [] } as Pilot)
    const onPaid = mock(() => {})
    const companion = { id: 'pt-gone', name: 'Gone', host: { kind: 'pilot', id: 'p1' } } as const
    payActivation(
      { store, pilot, mech: null, crawler: null },
      action({ companion: companion as PlayAction['companion'] }),
      'EP',
      FREE,
      onPaid
    )
    expect(onPaid).not.toHaveBeenCalled()
    expect(calls).toEqual([])
  })
})

describe('a spend says itself with Undo', () => {
  afterEach(() => toast.dismiss())

  const undoOf = (id: string) => {
    const line = toast.getToasts().find((t) => t.id === id)
    const action = line && 'action' in line ? line.action : undefined
    return action && typeof action === 'object' && 'onClick' in action ? action.onClick : undefined
  }

  test("the pilot's AP: Undo writes back the AP it started from", async () => {
    const spender = { ...pilot, currentAP: 3 } as Pilot
    const { store, calls } = stubStore(spender)
    payActivation(
      { store, pilot: spender, mech: null, crawler: null },
      action(),
      'AP',
      { ...FREE, epCost: 1 },
      () => {}
    )
    expect(calls).toEqual([{ type: 'pilot', id: 'p1', patch: { currentAP: 2 } }])
    const undo = undoOf('pilot:p1:currentAP')
    expect(undo).toBeDefined()
    undo?.({} as never)
    await Promise.resolve()
    expect(calls.at(-1)).toEqual({ type: 'pilot', id: 'p1', patch: { currentAP: 3 } })
  })
})
