/**
 * Tests for DowntimeWizard — the guided Downtime loop on the light display.
 *
 * Verifies the wizard is driven from the real "Crawler Downtime" Guide in the
 * reference ORM (not a hard-coded array) at the step the Game's `downtime`
 * row is on: it renders that step's name + phase and the step track, fills a
 * ready pip for each member who is done, sends "I'm done" through
 * `markStepDone`, and gives Next step to the Mediator alone (plan D8, §8 A1).
 * Reference content needs the ORM, so preload('all') runs once.
 */

import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { EntityHrefProvider } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { crawlerFixture } from '../../__tests__/fixtures'
import { DowntimeWizard } from '../DowntimeWizard'
import { downtimeHandle } from './downtimeFixture'

const crawler = crawlerFixture({ id: 'c1', name: 'Hauler', techLevel: '3', crawlerBays: [] })

const MEMBERS = [
  { userId: 'u-ash', displayName: 'Ash' },
  { userId: 'u-bex', displayName: 'Bex' },
]

function renderWizard({
  stepIndex = 0,
  done = [] as string[],
  mediator = false,
  viewerId = 'u-ash',
} = {}) {
  const { handle, calls } = downtimeHandle({
    running: true,
    stepIndex,
    members: MEMBERS,
    completedBy: MEMBERS.filter((m) => done.includes(m.userId)),
  })
  const view = render(
    <EntityHrefProvider value={() => undefined}>
      <DowntimeWizard crawler={crawler} downtime={handle} mediator={mediator} viewerId={viewerId} />
    </EntityHrefProvider>
  )
  return { ...view, calls }
}

describe('DowntimeWizard', () => {
  test("drives the Game's step from the reference guide (name + phase)", () => {
    const { container } = renderWizard()
    expect(container.querySelector('.pc-dt')).toBeTruthy()
    // Step 1 of the SRD procedure is "Tally Salvage" in the Post-Session phase.
    expect(container.textContent).toContain('Tally Salvage')
    expect(container.querySelector('.pc-dt-head')?.firstElementChild?.textContent).toBe(
      'Post-Session'
    )
    expect(container.querySelector('.pc-dt-count')?.textContent).toContain('Step 1 /')
  })

  test('the step track marks where the table is', () => {
    renderWizard({ stepIndex: 2 })
    const track = screen.getByRole('list', { name: 'Downtime steps' })
    const steps = within(track).getAllByRole('listitem')
    const guide = SalvageUnionReference.Guides.find((g) => g.guideType === 'downtime')
    expect(steps).toHaveLength(guide?.steps?.length ?? 0)
    expect(steps[2]?.getAttribute('aria-current')).toBe('step')
    expect(steps[1]?.getAttribute('aria-label')).toContain(', done')
    expect(steps[3]?.getAttribute('aria-current')).toBeNull()
  })

  test("a ready pip per member, filled from the row's completedBy", () => {
    renderWizard({ done: ['u-bex'] })
    const ready = screen.getByRole('list', { name: 'Done with this step: 1 of 2' })
    expect(within(ready).getByText('✓ Bex')).toBeTruthy()
    expect(within(ready).getByText('Ash')).toBeTruthy()
  })

  test("I'm done marks the viewer done through markStepDone, and undoes it", () => {
    const first = renderWizard()
    fireEvent.click(screen.getByRole('button', { name: "I'm done" }))
    expect(first.calls).toEqual([{ name: 'markDone', args: [true] }])
    first.unmount()

    const again = renderWizard({ done: ['u-ash'] })
    const done = screen.getByRole('button', { name: '✓ Done' })
    expect(done.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(done)
    expect(again.calls).toEqual([{ name: 'markDone', args: [false] }])
  })

  test('only the Mediator moves the table on', () => {
    const player = renderWizard()
    const labels = [...player.container.querySelectorAll('button')].map((b) => b.textContent)
    expect(labels).not.toContain('Next step ›')
    expect(labels).not.toContain('‹ Prev')
    player.unmount()

    const mediator = renderWizard({ mediator: true })
    fireEvent.click(screen.getByRole('button', { name: 'Next step ›' }))
    expect(mediator.calls).toEqual([{ name: 'advance', args: [] }])
  })

  test('Next step is disabled on the last step', () => {
    const guide = SalvageUnionReference.Guides.find((g) => g.guideType === 'downtime')
    const last = (guide?.steps?.length ?? 1) - 1
    renderWizard({ stepIndex: last, mediator: true })
    const next = screen.getByRole('button', { name: 'Next step ›' }) as HTMLButtonElement
    expect(next.disabled).toBe(true)
  })

  test('Trade step renders its reused RollTable (Trading Bay)', () => {
    const guide = SalvageUnionReference.Guides.find((g) => g.guideType === 'downtime')
    const idx = (guide?.steps ?? []).findIndex((s) => s.name === 'Trade')
    expect(idx).toBeGreaterThan(-1)
    const { container } = renderWizard({ stepIndex: idx })
    expect(container.textContent).toContain('Trade')
    expect(container.querySelector('.pc-dt-table table')).toBeTruthy()
  })
})
