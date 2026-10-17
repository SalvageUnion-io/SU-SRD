/**
 * The Mediator Dashboard as the Mediator uses it (board M1;
 * docs/architecture/mediator-dashboard.md): the commonest loop — see the
 * problem on a seat card, tap it, propose the fix — plus the tray, Downtime,
 * and the offline rule that every control is disabled, never hidden.
 *
 * Presentational: the view takes the table and the writes as props, so this
 * renders it with fixtures and records what it asks for.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { proposalTargets } from 'cantina-domain/games/proposals'
import { downtimeStepNames } from 'cantina-domain/rules/downtime'
import { createRef } from 'react'
import type { MediatorTableView, MediatorTableWrites } from '../MediatorDashboardView'
import { MediatorDashboardView } from '../MediatorDashboardView'
import { readTrayNpc } from '../opposition.model'
import { tableSeats } from '../seatCards.model'
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
    rename: record('rename'),
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
    // The seat is a Row in select mode; its foot names the problem.
    const pickle = screen.getByRole('radio', { name: /^Pickle, / }).closest('li')
    expect(pickle?.textContent).toContain('Overheating')
    expect(pickle?.textContent).toContain('▲')
    // HP and AP are label-first chips on the Row.
    const cells = [...(pickle?.querySelectorAll('.su-entity-row .su-stat-cell') ?? [])]
    expect(cells.map((c) => c.firstElementChild?.textContent)).toEqual(['HP', 'AP'])
    // View opens the read-only sheet, a control apart from the radio.
    const view = screen.getByRole('link', { name: 'View Pickle' })
    expect(view.getAttribute('href')).toBe('/sheet/pilot/pickle')
    expect(view.closest('[role="radio"]')).toBeNull()
  })
})

describe('the display', () => {
  test('its tabs, Tables between Tell the table and SRD, and Log at the far end', async () => {
    await renderView()
    const list = screen.getAllByRole('tablist', { name: 'Display' })[0]
    if (!list) throw new Error('no Display tabs')
    expect(
      within(list)
        .getAllByRole('tab')
        .map((t) => t.textContent)
    ).toEqual(['Opposition', 'Proposals', 'Tell the table', 'Tables', 'SRD', 'Log'])
  })

  test('Tables opens the roll tables', async () => {
    await renderView()
    const tab = screen.getAllByRole('tab', { name: 'Tables' })[0]
    if (!tab) throw new Error('no Tables tab')
    await act(async () => {
      fireEvent.click(tab)
    })
    expect(screen.getAllByText('Core Mechanic').length).toBeGreaterThan(0)
  })
})

describe('see the problem, propose the fix', () => {
  test('tapping a seat aims the dock at that pilot and moves focus to To', async () => {
    const toRef = await renderView()
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /^Judge, / }))
    })
    expect(screen.getByRole('radio', { name: /^Judge, / }).getAttribute('aria-checked')).toBe(
      'true'
    )
    expect((screen.getByLabelText('Target') as HTMLSelectElement).value).toBe('row-judge')
    expect(document.activeElement).toBe(toRef.current)
  })

  test('the preview shows before → after, and Propose sends the value and the reason', async () => {
    await renderView()
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /^Judge, / }))
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
  test('hidden from players, with an HP gauge and a Morale roll per NPC', async () => {
    await renderView()
    expect(screen.getByText('Hidden from players · 1 on the field')).toBeTruthy()
    const hp = within(screen.getByRole('group', { name: 'Rifle Squad HP' })).getByRole('slider', {
      name: 'HP',
    })
    expect(hp.getAttribute('aria-valuetext')).toBe('HP 7 of 10')
    await act(async () => {
      fireEvent.keyDown(hp, { key: 'ArrowLeft' })
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
    // The NPC's HP gauge reads out and cannot be set.
    const hp = screen.getByRole('group', { name: 'Rifle Squad HP' })
    expect(within(hp).queryByRole('slider')).toBeNull()
    expect(within(hp).getByRole('img', { name: 'HP 7 of 10' })).toBeTruthy()
    // The table is still there to read.
    expect(screen.getByRole('radio', { name: /^Pickle, / })).toBeTruthy()
  })
})
