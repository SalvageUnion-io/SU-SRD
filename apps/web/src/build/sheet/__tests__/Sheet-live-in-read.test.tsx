/**
 * Read still writes session state (R11, ruleset §1.2): for whoever may write
 * the sheet, a pilot's HP and AP and a mech's SP, EP and Heat step in Read,
 * each change one line with Undo (K5). A sheet the viewer may not write is a
 * read-out. Read also lists the unit's Actions (R65), which Edit leaves out.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { ToasterMount, toast } from '../../../components/index'
import { MechSheet } from '../MechSheet'
import { PilotSheet } from '../PilotSheet'

beforeAll(hydrateStores)
afterEach(async () => {
  await act(async () => {
    toast.dismiss()
  })
  cleanup()
})

const pilot: Pilot = pilotFixture({ id: 'p-live', name: 'Yara Voss', currentHP: 7, currentAP: 3 })
const mech: Mech = mechFixture({
  id: 'm-live',
  name: 'Buzzard',
  chassisRef: 'mule',
  systems: ['automated-weapon-turret'],
  currentSP: 5,
  currentEP: 4,
  currentHeat: 1,
})

function renderPilot(props: { readOnly: boolean; live: boolean }) {
  const update = mock(async () => null)
  render(
    <>
      <PilotSheet
        pilot={pilot}
        store={makeSingleUnitStore('pilot', pilot, { update })}
        {...props}
      />
      <ToasterMount />
    </>
  )
  return update
}

function renderMech(props: { readOnly: boolean; live: boolean }) {
  const update = mock(async () => null)
  render(
    <>
      <MechSheet mech={mech} store={makeSingleUnitStore('mech', mech, { update })} {...props} />
      <ToasterMount />
    </>
  )
  return update
}

const press = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}
const patches = (update: ReturnType<typeof mock>) => update.mock.calls.map((call) => call[2])

describe('a pilot’s sheet in Read', () => {
  test('HP and AP step for whoever may write it, and the change says itself with Undo', async () => {
    const update = renderPilot({ readOnly: true, live: true })
    await press(/^Decrease H(it )?P/)
    expect(patches(update)).toContainEqual({ currentHP: 6 })
    await press(/^Increase A(bility )?P/)
    expect(patches(update)).toContainEqual({ currentAP: 4 })
    const undo = await screen.findAllByRole('button', { name: 'Undo' })
    expect(undo.length).toBeGreaterThan(0)
    await act(async () => {
      fireEvent.click(undo[0] as HTMLElement)
    })
    // Undo writes back the value the run started from.
    expect(patches(update).some((p) => p.currentHP === 7 || p.currentAP === 3)).toBe(true)
  })

  test('a sheet the viewer may not write is a read-out', () => {
    const update = renderPilot({ readOnly: true, live: false })
    expect(screen.queryByRole('button', { name: /^Decrease H(it )?P/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Increase A(bility )?P/ })).toBeNull()
    expect(update).not.toHaveBeenCalled()
  })

  test('Read lists the Actions; Edit leaves them out', () => {
    renderPilot({ readOnly: true, live: true })
    expect(screen.getByRole('button', { name: 'Collapse Actions' })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Long actions' })).toBeTruthy()
    cleanup()
    renderPilot({ readOnly: false, live: false })
    expect(screen.queryByRole('button', { name: 'Collapse Actions' })).toBeNull()
  })
})

describe('a mech’s sheet in Read', () => {
  test('SP, EP and Heat step for whoever may write it', async () => {
    const update = renderMech({ readOnly: true, live: true })
    await press(/^Decrease S(tructure )?P/)
    await press(/^Decrease E(nergy )?P/)
    await press(/^Increase Heat/)
    expect(patches(update)).toEqual(
      expect.arrayContaining([{ currentSP: 4 }, { currentEP: 3 }, { currentHeat: 2 }])
    )
  })

  test('its Actions are grouped by action type, each row its effect', () => {
    renderMech({ readOnly: true, live: true })
    expect(screen.getByRole('button', { name: 'Collapse Actions' })).toBeTruthy()
    const passive = screen.getByRole('list', { name: 'Passive actions' })
    const row = within(passive)
      .getAllByRole('listitem')
      .find((li) => li.textContent?.startsWith('Automated Weapon Turret')) as HTMLElement
    expect(row).toBeDefined()
    expect(row.querySelector('.su-sheet-act__effect')?.textContent?.trim()).not.toBe('')
    // The turret's row: no Use on a sheet, which reads (ADR-021).
    expect(screen.queryByRole('button', { name: /^Use / })).toBeNull()
  })
})
