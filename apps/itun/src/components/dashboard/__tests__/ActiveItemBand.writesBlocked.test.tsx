/**
 * The Dashboard's refused-write path (ADR-030 §1).
 *
 * The Dashboard voided 20 store writes with no `.catch`. `entityStore.update`
 * throws `WritesBlockedOffline` whenever the server of record is unreachable,
 * so every one of those was an unhandled rejection: the player taps Jettison,
 * the lot stays in the hold, and nothing anywhere says why. The Live Sheet had
 * already solved this with `runWrite`; the Dashboard had simply never been
 * wired to it.
 *
 * The toast IS the proof. It is raised by `runWrite`'s rejection handler and by
 * nothing else on this path — a voided write produces the identical rejected
 * promise and no toast at all. So asserting the copy appears asserts, exactly,
 * that the rejection was caught rather than dropped.
 *
 * (Bun reports a genuinely-unhandled rejection *between* tests rather than
 * through a `process.on('unhandledRejection')` listener the test can observe,
 * which is why this pins the visible outcome rather than the leak.)
 *
 * Uses toBeTruthy() not toBeInTheDocument() (Wave 4 workaround).
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { Toaster, toast } from 'component-lib'
import type { CargoLot } from '../../../lib/schemas/cargoLot'
import { WritesBlockedOffline } from '../../../stores/entityBackend'
import { usePlayStateStore } from '../../../stores/playStateStore'
import { mechFixture } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import type { PlayStore } from '../ActiveItemBand'
import { ActiveItemBand } from '../ActiveItemBand'

afterEach(() => {
  // Sonner's toast state is module-global — clear it so a refusal never leaks
  // into a later suite. Unmounting is left to the preload's act()-wrapped hook.
  toast.dismiss()
})

const lot: CargoLot = {
  id: 'lot-a',
  kind: 'unit',
  name: 'Sealed Crate',
  cat: 'SEALED',
  units: 1,
  code: 'SEA',
}

const mech = mechFixture({
  id: 'm1',
  name: 'Iron Mongrel',
  chassisRef: 'unknown-chassis',
  cargoLots: [lot],
  currentSP: 10,
  maxCargoModifier: 6,
})

/** A store that refuses every write, exactly as a Disconnected one does. */
function blockedStore(): PlayStore {
  return makeEntityStoreMock({
    get: (_type, id) => (id === mech.id ? mech : null),
    update: () => Promise.reject(new WritesBlockedOffline()),
  }).getState()
}

describe('ActiveItemBand — writes refused by connectivity', () => {
  test('a refused Jettison tells the player instead of failing silently', async () => {
    usePlayStateStore.setState({ mount: 'mech', wheel: 0 })
    render(
      <>
        <ActiveItemBand mech={mech} pilot={null} store={blockedStore()} />
        <Toaster />
      </>
    )

    fireEvent.click(screen.getByText('Storage'))
    fireEvent.click(screen.getByLabelText('Jettison Sealed Crate'))

    // The copy is the point: a withdrawn write that says nothing reads as a
    // broken app, which is the whole defect this replaces.
    expect(await screen.findByText(/read-only until the connection returns/i)).toBeTruthy()
  })

  test('a refused reactor action is reported too, not just cargo', async () => {
    // Vent is a different handler on a different band control — the fix is the
    // chokepoint, not one button, so a second path pins that.
    usePlayStateStore.setState({ mount: 'mech', wheel: 0 })
    render(
      <>
        <ActiveItemBand mech={mech} pilot={null} store={blockedStore()} />
        <Toaster />
      </>
    )

    fireEvent.click(screen.getByTitle('Vent Heat to 0'))

    expect(await screen.findByText(/read-only until the connection returns/i)).toBeTruthy()
  })

  test('a refused write does not also claim the action succeeded', async () => {
    // Handling the rejection is not enough on its own. These handlers fired the
    // write and then stated the outcome unconditionally, so a Disconnected
    // player got BOTH the refusal toast and "Vented — Heat 0, Vulnerable." —
    // two contradictory messages, one of them a false claim about game state.
    // That is worse than the silence `runWrite` was introduced to fix.
    //
    // The readout is now passed as `onApplied`, so it is conditional on the
    // write it describes. The handlers stayed synchronous.
    usePlayStateStore.setState({ mount: 'mech', wheel: 0 })
    render(
      <>
        <ActiveItemBand mech={mech} pilot={null} store={blockedStore()} />
        <Toaster />
      </>
    )

    fireEvent.click(screen.getByTitle('Vent Heat to 0'))

    // The refusal still arrives...
    expect(await screen.findByText(/read-only until the connection returns/i)).toBeTruthy()
    // ...and the vent readout does not, because the vent did not happen.
    expect(screen.queryByText(/Vented — Heat 0/i)).toBeNull()
  })
})
