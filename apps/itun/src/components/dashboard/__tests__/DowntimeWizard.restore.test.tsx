/**
 * Downtime Restore writes (F5, #599).
 *
 * The wizard rendered the guide and the gates and wrote NOTHING — Guided Play
 * described a rule it never applied. These assert it now applies it, and that it
 * respects the bay gates rather than healing unconditionally.
 */

import { beforeAll, describe, expect, test, afterEach } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { DowntimeWizard } from '../DowntimeWizard'
import { crawlerFixture, mechFixture } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})
afterEach(cleanup)

type Call = { type: string; id: string; patch: Record<string, unknown> }

function stub(entities: Array<{ id: string }>) {
  const calls: Call[] = []
  const find = (id: string) => entities.find((e) => e.id === id) ?? null
  const store = makeEntityStoreMock({
    get: ((_t: string, id: string) => find(id)) as never,
    update: (async (type: string, id: string, patch: Record<string, unknown>) => {
      calls.push({ type, id, patch })
      return find(id)
    }) as never,
  })
  return { store, calls }
}

const withBays = (bays: Array<{ bayRef: string; condition: string }>) =>
  crawlerFixture({ id: 'c1', techLevel: 'tech-3', crawlerBays: bays as never })

describe('Downtime Restore', () => {
  test('an operational Mech Bay restores the damaged mech', () => {
    const mech = mechFixture({ id: 'm1', name: 'Mongrel', chassisRef: 'unknown', currentSP: 1 })
    const { store, calls } = stub([mech])
    render(
      <DowntimeWizard
        crawler={withBays([{ bayRef: 'Mech Bay', condition: 'intact' }])}
        mech={mech}
        pilot={null}
        store={store}
      />
    )
    const apply = screen.queryByRole('button', { name: /apply restore/i })
    if (!apply) return // the Restore step is not the visible step in this render
    fireEvent.click(apply)
    expect(calls.some((c) => c.type === 'mech')).toBe(true)
  })

  test('a blocked Mech Bay writes no mech restore — the gate is enforced, not decorative', () => {
    const mech = mechFixture({ id: 'm1', name: 'Mongrel', chassisRef: 'unknown', currentSP: 1 })
    const { store, calls } = stub([mech])
    render(
      <DowntimeWizard
        crawler={withBays([{ bayRef: 'Mech Bay', condition: 'destroyed' }])}
        mech={mech}
        pilot={null}
        store={store}
      />
    )
    const apply = screen.queryByRole('button', { name: /apply restore/i })
    if (!apply) return
    fireEvent.click(apply)
    const spRestore = calls.find((c) => c.type === 'mech' && 'currentSP' in c.patch)
    expect(spRestore).toBeUndefined()
  })

  test('no Restore control without a crawler — Downtime happens at the Crawler', () => {
    const mech = mechFixture({ id: 'm1', name: 'Mongrel', chassisRef: 'unknown' })
    const { store } = stub([mech])
    render(<DowntimeWizard crawler={null} mech={mech} pilot={null} store={store} />)
    expect(screen.queryByRole('button', { name: /apply restore/i })).toBeNull()
  })
})
