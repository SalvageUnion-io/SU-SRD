/**
 * The Mediator Dashboard as the Mediator uses it (issue 1278, board M1;
 * docs/architecture/mediator-dashboard.md): the commonest loop — see the
 * problem on a seat card, tap it, propose the fix — plus the tray, Downtime,
 * and the offline rule that every control is disabled, never hidden.
 *
 * Presentational: the view takes the table and the writes as props, so this
 * renders it with fixtures and records what it asks for.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createRef } from 'react'
import { proposalTargets } from '../../../lib/games/proposals'
import { downtimeStepNames } from '../../../lib/rules/downtime'
import type { MediatorTableView, MediatorTableWrites } from '../MediatorDashboardView'
import { MediatorDashboardView } from '../MediatorDashboardView'
import { readTrayNpc } from '../opposition'
import { tableSeats } from '../seatCards'
import { TABLE_CREW, TABLE_MEMBERS, TABLE_SEATS } from './tableFixture'

const calls: { name: string; args: unknown[] }[] = []

const record =
  (name: string) =>
  async (...args: unknown[]) => {
    calls.push({ name, args })
  }

const writes: MediatorTableWrites = {
  downtime: {
    begin: record('begin'),
    advance: record('advance'),
    end: record('end'),
    spendUpkeep: record('spendUpkeep'),
  },
  tray: {
    add: record('add'),
    setHp: record('setHp'),
    morale: record('morale'),
    remove: record('remove'),
  },
  propose: record('propose'),
  broadcast: record('broadcast'),
  moreSent: () => calls.push({ name: 'moreSent', args: [] }),
  onFailure: () => calls.push({ name: 'onFailure', args: [] }),
}

const NOW = Date.parse('2026-10-09T12:00:00.000Z')

function view(over: Partial<MediatorTableView> = {}): MediatorTableView {
  return {
    gameId: 'g1',
    gameName: 'Reclamation of the Wastes',
    seats: tableSeats(TABLE_CREW, TABLE_SEATS, TABLE_MEMBERS),
    crawler: {
      id: 'tenacity',
      name: '#430 Tenacity',
      sp: 20,
      maxSP: 20,
      techLevel: 1,
      bays: 10,
      baysIntact: 10,
      scrapAtTl: 5,
    },
    downtime: { running: false, stepIndex: null, done: 0, upkeepSpent: false },
    downtimeSteps: downtimeStepNames(),
    memberCount: 5,
    npcs: [
      readTrayNpc({
        _id: 'n1',
        body: { name: 'Rifle Squad', currentHp: 7, maxHp: 10, statKind: 'hp', conditions: [] },
      }),
    ],
    targets: proposalTargets(TABLE_CREW),
    sent: [],
    sentLimit: 20,
    alerts: [],
    rolls: [],
    now: NOW,
    canWrite: true,
    ...over,
  }
}

async function renderView(over: Partial<MediatorTableView> = {}) {
  const toRef = createRef<HTMLInputElement>()
  await act(async () => {
    render(<MediatorDashboardView view={view(over)} writes={writes} toRef={toRef} />)
  })
  return toRef
}

beforeEach(() => {
  calls.length = 0
})

describe('the rail and the table', () => {
  test('a MEDIATOR stamp, the Game, and how many seats need attention', async () => {
    await renderView()
    expect(screen.getByText('Mediator')).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Reclamation of the Wastes' })
    ).toBeTruthy()
    expect(screen.getByText('4 seats · 2 need attention')).toBeTruthy()
  })

  test('a seat with a problem names it beside the ▲, so colour is never the only signal', async () => {
    await renderView()
    const pickle = screen.getByRole('button', { name: /^Pickle, / })
    expect(pickle.textContent).toContain('Overheating')
    expect(pickle.textContent).toContain('▲')
    // The callsign is a link to the read-only sheet, apart from the button.
    expect(screen.getByRole('link', { name: 'Pickle' }).getAttribute('href')).toBe(
      '/sheet/pilot/pickle'
    )
  })
})

describe('see the problem, propose the fix', () => {
  test('tapping a seat aims the dock at that pilot and moves focus to To', async () => {
    const toRef = await renderView()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Judge, / }))
    })
    expect(screen.getByRole('button', { name: /^Judge, / }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    expect((screen.getByLabelText('Target') as HTMLSelectElement).value).toBe('row-judge')
    expect(document.activeElement).toBe(toRef.current)
  })

  test('the preview shows before → after, and Propose sends the value and the reason', async () => {
    await renderView()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Judge, / }))
    })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Reason (optional)'), {
      target: { value: 'Ejection burn' },
    })
    expect(screen.getByText('Judge: HP 4 → 2 · “Ejection burn”')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Propose' }))
    })
    expect(calls).toEqual([
      {
        name: 'propose',
        args: [
          {
            entityId: 'row-judge',
            entityType: 'pilot',
            field: 'currentHP',
            after: 2,
            reason: 'Ejection burn',
          },
        ],
      },
    ])
  })

  test('a mech target offers its own fields, and the value is clamped to its maximum', async () => {
    await renderView()
    fireEvent.change(screen.getByLabelText('Target'), { target: { value: 'row-spectrum' } })
    const fields = within(screen.getByLabelText('Field')).getAllByRole('option')
    expect(fields.map((o) => o.textContent)).toEqual(['SP', 'Heat'])
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '40' } })
    expect(screen.getByText(/Pickle's Spectrum: SP 6 → 9 \(at most 9\)/)).toBeTruthy()
  })

  test('the three newest proposals show their state in words', async () => {
    const sent = [
      {
        _id: 'c1',
        entityId: 'bonesaw',
        entityType: 'pilot' as const,
        targetName: 'Bonesaw',
        field: 'currentHP',
        after: 8,
        reason: 'Shrapnel',
        state: 'applied' as const,
        ts: NOW - 60_000,
        mine: true,
        actorName: null,
      },
    ]
    await renderView({ sent: sent as unknown as MediatorTableView['sent'] })
    const dock = within(screen.getByRole('region', { name: 'Newest proposals' }))
    expect(dock.getByText('Bonesaw · HP → 8 · “Shrapnel”')).toBeTruthy()
    expect(dock.getByText('Applied')).toBeTruthy()
  })
})

describe('the opposition', () => {
  test('hidden from players, with an HP stepper and a Morale roll per NPC', async () => {
    await renderView()
    expect(screen.getByText('Hidden from players · 1 on the field')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove one Rifle Squad HP' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll Morale for Rifle Squad' }))
    })
    expect(calls.map((c) => c.name)).toEqual(['setHp', 'morale'])
    expect(calls[0]?.args[1]).toBe(6)
  })

  test('Remove asks first', async () => {
    await renderView()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove Rifle Squad' }))
    })
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(calls).toHaveLength(0)
  })
})

describe('Downtime', () => {
  test('not running: Begin Downtime', async () => {
    await renderView()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Begin Downtime' }))
    })
    expect(calls.map((c) => c.name)).toEqual(['begin'])
  })

  test('running: the step by its guide name, Pay upkeep only in its step, and End asks first', async () => {
    await renderView({ downtime: { running: true, stepIndex: 1, done: 3, upkeepSpent: false } })
    expect(screen.getByText('Step 2 of 10 · Upkeep & Upgrade')).toBeTruthy()
    expect(screen.getByText(/3 of 5 done · upkeep due: 5 TL1 scrap/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pay upkeep' })).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'End' }))
    })
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(calls).toHaveLength(0)
  })
})

describe('offline or outdated', () => {
  test('every control is disabled, none hidden, and what was read stays on screen', async () => {
    await renderView({ canWrite: false })
    for (const name of ['Begin Downtime', '+ From the reference', 'Propose']) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
    }
    expect(
      (screen.getByRole('button', { name: 'Roll Morale for Rifle Squad' }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    expect((screen.getByLabelText('Target') as HTMLSelectElement).disabled).toBe(true)
    // The table is still there to read.
    expect(screen.getByRole('button', { name: /^Pickle, / })).toBeTruthy()
  })
})
