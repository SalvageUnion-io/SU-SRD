/** A Module's EP is spent from its row, in a write the Change Log names it by (r5 C9). */

import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { mechFixture } from '../../../components/__tests__/fixtures'
import { makeEntityStoreMock } from '../../../components/__tests__/mockEntityStore'
import type { ChangeMeta } from '../../../replica/provenance'
import { MechSheet } from '../MechSheet'

type Captured = { patch: Record<string, unknown>; meta: ChangeMeta | undefined }

function sheet(currentEP: number) {
  const mech = mechFixture({
    id: 'mech-spend-1',
    chassisRef: 'scrapper',
    modules: ['zoom-optics'],
    currentEP,
  })
  const captured: Captured[] = []
  const store = makeEntityStoreMock({
    mechs: [mech],
    hydrated: { pilots: false, mechs: true, crawlers: true, npcs: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [mech]),
    get: mock((type: string, id: string) => (type === 'mech' && id === mech.id ? mech : null)),
    update: mock(
      async (_type: string, _id: string, patch: Record<string, unknown>, meta?: ChangeMeta) => {
        captured.push({ patch, meta })
        return mech
      }
    ),
  })
  render(<MechSheet mech={mech} store={store} />)
  return captured
}

describe('MechSheet — spend a Module’s EP', () => {
  test("pressing the Module's cost spends its EP, named for the Module", async () => {
    const captured = sheet(3)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Spend 1 EP for Zoom Optics' }))
    })
    expect(captured).toEqual([
      { patch: { currentEP: 2 }, meta: { kind: 'manual', source: 'live-sheet:Zoom Optics' } },
    ])
  })

  test('with too little EP left it spends none', async () => {
    const captured = sheet(0)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Spend 1 EP for Zoom Optics' }))
    })
    expect(captured).toEqual([])
  })
})
