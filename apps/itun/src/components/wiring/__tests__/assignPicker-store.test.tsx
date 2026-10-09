/**
 * AssignPicker against the REAL store (ADR-037).
 *
 * The two behaviours a mock `create` cannot show, because the store is what
 * implements them:
 *
 *  - **Changing is assigning again.** Picking a second crawler for a pilot
 *    replaces the first link in the same write, rather than leaving the pilot
 *    on two crawlers or refusing.
 *  - **A mech's crawler is its own.** Docking a mech touches neither its pilot
 *    link nor that pilot's crew link, and a pilot crewing a crawler does not
 *    put their mech in its bay.
 *
 * Signed-in backend with server commits stubbed (`signedInBackend.ts`), so the
 * links asserted are the ones that landed in IndexedDB too.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { ConnectionContext, SOLO_STATE } from '../../../lib/connection/connectionContext'
import { _resetDbSingleton, clearCache, softLinks as dbSoftLinks } from '../../../lib/db/index'
import type { SoftLink } from '../../../lib/schemas/softLink'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'
import { useEntityStore } from '../../../stores/entityStore'
import { AssignPicker } from '../AssignPicker'

withSignedInBackend()

const GAME = { kind: 'game', gameId: 'g1' } as const

const pilotInput = {
  schemaVersion: 1 as const,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  conditions: [],
  gameId: 'g1',
}

const mechInput = {
  schemaVersion: 1 as const,
  name: 'Iron Fist',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  gameId: 'g1',
}

const crawlerInput = {
  schemaVersion: 1 as const,
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  systems: [],
  gameId: 'g1',
}

function reset(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
}

beforeEach(async () => {
  _resetDbSingleton()
  await clearCache()
  reset()
  const store = useEntityStore.getState()
  await Promise.all([
    store.hydrate('pilot'),
    store.hydrate('mech'),
    store.hydrate('crawler'),
    store.hydrate('softLink'),
  ])
})

afterEach(async () => {
  cleanup()
  await clearCache()
  reset()
})

const shape = (l: SoftLink) => `${l.type}:${l.from.id}>${l.to.id}`
const live = () => useEntityStore.getState().softLinks.map(shape).sort()
const persisted = async () => (await dbSoftLinks.list()).map(shape).sort()

function connected(ui: ReactElement) {
  return render(
    <ConnectionContext.Provider value={{ ...SOLO_STATE, mode: 'connected' }}>
      {ui}
    </ConnectionContext.Provider>
  )
}

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Confirm, and keep the whole write inside `act`.
 *
 * The write goes through IndexedDB, which settles over several macrotasks —
 * after `act`'s own flush — and the store update and the dialog closing that
 * follow it would land outside `act`, which the test preload fails on. So this
 * waits, inside the scope, for the store's links to change, then one more turn
 * for the picker's own state to follow.
 */
async function confirmAndSettle(confirmName: RegExp) {
  const before = live().join()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: confirmName }))
    for (let i = 0; i < 200 && live().join() === before; i++) await tick(5)
    await tick()
  })
  expect(screen.queryByRole('dialog')).toBeNull()
}

async function pick(trigger: RegExp, name: string, confirmName: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: trigger }))
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(name) }))
  await confirmAndSettle(confirmName)
}

describe('AssignPicker — through the store', () => {
  test('Change Crawler moves the pilot: the old link goes in the same write', async () => {
    const store = useEntityStore.getState()
    const pilot = await store.create('pilot', pilotInput)
    const first = await store.create('crawler', crawlerInput)
    const second = await store.create('crawler', { ...crawlerInput, name: 'Second Home' })
    await store.create('softLink', {
      from: { type: 'pilot', id: pilot.id },
      to: { type: 'crawler', id: first.id },
      type: 'pilot-to-crawler',
    })

    connected(
      <AssignPicker
        subject={{ type: 'pilot', id: pilot.id }}
        container={GAME}
        pick="crawler"
        filled
        exclude={[first.id]}
      />
    )
    await pick(/change crawler for this pilot/i, 'Second Home', /confirm crawler assignment/i)

    const expected = [`pilot-to-crawler:${pilot.id}>${second.id}`]
    expect(live()).toEqual(expected)
    expect(await persisted()).toEqual(expected)
  })

  test('Change Mech takes the picked mech off the pilot it flew', async () => {
    const store = useEntityStore.getState()
    const yara = await store.create('pilot', pilotInput)
    const dag = await store.create('pilot', { ...pilotInput, name: 'Dag' })
    const fist = await store.create('mech', mechInput)
    // Dag flies the Iron Fist; Yara has none yet.
    await store.create('softLink', {
      from: { type: 'mech', id: fist.id },
      to: { type: 'pilot', id: dag.id },
      type: 'mech-to-pilot',
    })

    connected(
      <AssignPicker subject={{ type: 'pilot', id: yara.id }} container={GAME} pick="mech" />
    )
    await pick(/assign mech to pilot/i, 'Iron Fist', /confirm mech assignment/i)

    // A mech carries one pilot: it moved, and Dag is left unmounted.
    expect(live()).toEqual([`mech-to-pilot:${fist.id}>${yara.id}`])
  })

  test('docking a mech leaves its pilot and its pilot’s crawler alone', async () => {
    const store = useEntityStore.getState()
    const pilot = await store.create('pilot', pilotInput)
    const mech = await store.create('mech', mechInput)
    const home = await store.create('crawler', crawlerInput)
    const bay = await store.create('crawler', { ...crawlerInput, name: 'Repair Bay' })
    await store.create('softLink', {
      from: { type: 'mech', id: mech.id },
      to: { type: 'pilot', id: pilot.id },
      type: 'mech-to-pilot',
    })
    await store.create('softLink', {
      from: { type: 'pilot', id: pilot.id },
      to: { type: 'crawler', id: home.id },
      type: 'pilot-to-crawler',
    })

    connected(
      <AssignPicker subject={{ type: 'mech', id: mech.id }} container={GAME} pick="crawler" />
    )
    // The pilot's crawler is offered like any other: nothing is inherited.
    fireEvent.click(screen.getByRole('button', { name: /assign crawler to mech/i }))
    expect(screen.getByRole('radio', { name: /Iron Tortoise/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /Repair Bay/ }))
    await confirmAndSettle(/confirm crawler assignment/i)

    expect(live()).toEqual(
      [
        `mech-to-crawler:${mech.id}>${bay.id}`,
        `mech-to-pilot:${mech.id}>${pilot.id}`,
        `pilot-to-crawler:${pilot.id}>${home.id}`,
      ].sort()
    )
  })
})
