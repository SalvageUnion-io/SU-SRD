/**
 * The Dashboard's phone form (ADR-043).
 *
 *  - The switch reads both axes: a landscape phone gets the phone form too.
 *  - The open unit tab opens on the Major and follows it when the mount
 *    changes, and only then.
 *  - A `MajorModel` renders through both forms with every field it carries,
 *    and a phone control calls the very handler its canvas twin calls.
 *  - The real Majors order their phone bays per board D4 / D5.
 *  - The shell: unit tabs in a fixed order, a Minor's warning spelled out,
 *    pinned vitals off the Major's tab only, read-only through one fieldset,
 *    focus to the new tab's heading on a mount change.
 *  - The resolve screen's bottom bar shows only the next step, Push once a
 *    roll and only on a mech action, and a Cascade Failure is confirmed.
 *  - The deck's pennant opens AND pays; the row only opens.
 *
 * Uses toBeTruthy() not toBeInTheDocument() (jest-dom's matchers are not on
 * bun:test's expect).
 */

import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { Mech } from '../../../lib/schemas/mech'
import type { Pilot } from '../../../lib/schemas/pilot'
import { mechFixture } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import type { PhoneUnit } from '../DashboardPhone'
import { DashboardPhone } from '../DashboardPhone'
import { DashboardFormContext, isPhoneForm, useUnitTab } from '../dashboardForm'
import type { MajorModel } from '../MajorFrame'
import { MajorFrame } from '../MajorFrame'
import { MechMajor } from '../MechSlot'
import { PhoneResolve } from '../PhoneResolve'
import type { ResolveModel } from '../ResolvePanel'
import type { PlayStore } from '../SlotRow'
import type { SlotKind } from '../slotLayout'
import type { MountState } from '../useSeat'

const noop = () => {}

function Phone({ children, between = null }: { children: ReactNode; between?: ReactNode }) {
  return <DashboardFormContext value={{ form: 'phone', between }}>{children}</DashboardFormContext>
}

describe('isPhoneForm — both axes (D1)', () => {
  test('a desktop window keeps the canvas', () => {
    expect(isPhoneForm(1440, 860)).toBe(false)
  })
  test('a portrait phone gets the phone form', () => {
    expect(isPhoneForm(375, 812)).toBe(true)
    expect(isPhoneForm(390, 844)).toBe(true)
  })
  test('a landscape phone gets it too: its height would draw the canvas near 0.49', () => {
    expect(isPhoneForm(852, 393)).toBe(true)
  })
  test('a short desktop window gets it below about 496px', () => {
    expect(isPhoneForm(1440, 480)).toBe(true)
    expect(isPhoneForm(1440, 500)).toBe(false)
  })
})

describe('useUnitTab — the open tab follows the Major (D4)', () => {
  test('opens on the Major, follows each mount change, and is otherwise the player’s', () => {
    const { result, rerender } = renderHook(
      ({ mount }: { mount: MountState }) => useUnitTab(mount),
      {
        initialProps: { mount: 'pilot' },
      }
    )
    expect(result.current[0]).toBe('pilot')

    // The player moves it.
    act(() => result.current[1]('crawler'))
    expect(result.current[0]).toBe('crawler')

    // Board selects Mech.
    rerender({ mount: 'mech' })
    expect(result.current[0]).toBe('mech')

    // A re-render with the same mount leaves the player's choice alone.
    act(() => result.current[1]('pilot'))
    rerender({ mount: 'mech' })
    expect(result.current[0]).toBe('pilot')

    // Downtime starting selects Crawler; ending selects the seat's Major.
    rerender({ mount: 'downtime' })
    expect(result.current[0]).toBe('crawler')
    rerender({ mount: 'mech' })
    expect(result.current[0]).toBe('mech')

    // Dismount or Eject selects Pilot.
    rerender({ mount: 'pilot' })
    expect(result.current[0]).toBe('pilot')
  })
})

/** A model with every field a bay can carry, and a prompt. */
function fixtureModel(onVent: () => void): MajorModel {
  return {
    fam: 'mech',
    stampLabel: 'Boarded',
    bays: [
      {
        label: 'Reactor',
        gauges: [
          { label: 'Heat', value: 3, max: 8, tone: 'mech', danger: 6 },
          { label: 'EP', value: 5, max: 9, tone: 'mech' },
        ],
        lines: [{ text: 'Floodlights damaged', warn: true }],
        chips: [{ text: 'Spare part' }],
        buttons: [
          { label: 'Vent', onClick: onVent, variant: 'go' },
          { label: 'Shutdown', onClick: noop },
        ],
      },
      {
        label: 'Egress',
        side: true,
        buttons: [{ label: 'Dismount', onClick: noop, variant: 'go' }],
      },
    ],
  }
}

describe('a MajorModel renders through both forms', () => {
  for (const form of ['canvas', 'phone'] as const) {
    test(`${form}: every gauge, line, chip, button and the stamp`, () => {
      const onVent = mock(noop)
      const frame = <MajorFrame view={fixtureModel(onVent)} />
      render(form === 'phone' ? <Phone>{frame}</Phone> : frame)
      expect(screen.getByText('Boarded')).toBeTruthy()
      expect(screen.getByRole('img', { name: /^Heat 3 of 8/ })).toBeTruthy()
      expect(screen.getByRole('img', { name: /^EP 5 of 9/ })).toBeTruthy()
      expect(screen.getByText('Floodlights damaged')).toBeTruthy()
      expect(screen.getByText('Spare part')).toBeTruthy()
      for (const name of ['Vent', 'Shutdown', 'Dismount']) {
        expect(screen.getByRole('button', { name })).toBeTruthy()
      }
      // The same handler, whichever form drew the button.
      fireEvent.click(screen.getByRole('button', { name: 'Vent' }))
      expect(onVent).toHaveBeenCalledTimes(1)
    })
  }

  test('phone: the main bays, then what goes between, then the side bays', () => {
    render(
      <Phone between={<p>the deck</p>}>
        <MajorFrame view={fixtureModel(noop)} />
      </Phone>
    )
    const order = [
      screen.getByRole('button', { name: 'Vent' }),
      screen.getByText('the deck'),
      screen.getByRole('button', { name: 'Dismount' }),
    ]
    for (let i = 1; i < order.length; i += 1) {
      const prev = order[i - 1] as HTMLElement
      const next = order[i] as HTMLElement
      expect(prev.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  test('phone: a prompt covers the column and keeps its pinned gauges', () => {
    const onClose = mock(noop)
    const model: MajorModel = {
      ...fixtureModel(noop),
      overlay: {
        title: 'Take Structure Damage',
        onClose,
        gauges: [{ label: 'SP', value: 7, max: 9, tone: 'mech' }],
        body: <p>how much</p>,
        actions: [{ label: 'Apply −1 SP', onClick: noop, variant: 'go' }],
      },
    }
    render(
      <Phone between={<p>the deck</p>}>
        <MajorFrame view={model} />
      </Phone>
    )
    const dialog = screen.getByRole('dialog', { name: 'Take Structure Damage' })
    expect(within(dialog).getByRole('img', { name: /^SP 7 of 9/ })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Apply −1 SP' })).toBeTruthy()
    // The bays and the deck are covered, not beside it.
    expect(screen.queryByText('the deck')).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

type Call = { type: string; id: string; patch: Record<string, unknown> }

function stubStore(entities: Array<Mech | Pilot>): { store: PlayStore; calls: Call[] } {
  const calls: Call[] = []
  const store: PlayStore = makeEntityStoreMock({
    get: (_type, id) => entities.find((e) => e.id === id) ?? null,
    update: async (type, id, patch) => {
      calls.push({ type, id, patch })
      return entities.find((e) => e.id === id) ?? null
    },
  }).getState()
  return { store, calls }
}

describe('the Mech tab (board D4)', () => {
  const mech = mechFixture({
    id: 'm-phone',
    name: 'Scrapper',
    chassisRef: 'scrapper',
    currentSP: 9,
    currentHeat: 3,
  })

  function renderMech(store: PlayStore) {
    return render(
      <Phone between={<p>the deck</p>}>
        <MechMajor
          mech={mech}
          store={store}
          activeEffects={[]}
          boarded
          onToggleEffect={noop}
          onDismount={noop}
          onEject={noop}
          damagePrompt={null}
        />
      </Phone>
    )
  }

  test('SP and EP cells, then Heat with Push and Vent first, the deck, then Egress', () => {
    const { store } = stubStore([mech])
    renderMech(store)
    expect(screen.getByRole('img', { name: /^SP 9 of \d+/ })).toBeTruthy()
    expect(screen.getByRole('img', { name: /^EP \d+ of \d+/ })).toBeTruthy()
    expect(screen.getByRole('img', { name: /^Heat 3 of \d+/ })).toBeTruthy()
    const reactor = screen.getByRole('group', { name: 'Reactor' })
    const verbs = within(reactor)
      .getAllByRole('button')
      .map((b) => b.textContent)
      .filter((t) => t !== 'ⓘ' && t !== '*')
    expect(verbs.slice(0, 2)).toEqual(['Push · +2 Heat', 'Vent'])
    expect(verbs).toContain('Heat Check')
    expect(verbs).toContain('Shut Down')
    expect(verbs).toContain('Take Damage')
    expect(verbs.some((v) => v?.startsWith('Storage · '))).toBe(true)
    const deck = screen.getByText('the deck')
    const dismount = screen.getByRole('button', { name: 'Dismount' })
    expect(reactor.compareDocumentPosition(deck) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(deck.compareDocumentPosition(dismount) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('Vent writes what the canvas’s Vent writes', async () => {
    const { store, calls } = stubStore([mech])
    renderMech(store)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Vent' }))
    })
    expect(calls).toEqual([
      { type: 'mech', id: 'm-phone', patch: { currentHeat: 0, vulnerable: true } },
    ])
  })
})

function unit(name: string | null, problems: string[] = []): PhoneUnit {
  return { name, problems, body: <button type="button">{`${name} control`}</button> }
}

function Shell({
  tab = 'mech',
  major = 'mech',
  mountKey = 'mech:m1',
  readOnly = null,
  resume = null,
}: {
  tab?: SlotKind
  major?: SlotKind
  mountKey?: string
  readOnly?: string | null
  resume?: { name: string; onResume: () => void } | null
}) {
  return (
    <DashboardPhone
      gameName="Reclamation"
      homeHref="/"
      major={major}
      mountKey={mountKey}
      mountNote="Boarded Scrapper"
      tab={tab}
      onTab={noop}
      units={{
        pilot: unit('Rook', ['Major injury: broken arm']),
        mech: unit('Scrapper'),
        crawler: unit('Tenacity'),
      }}
      pinned={[
        { label: 'SP', value: 9, max: 9 },
        { label: 'EP', value: 6, max: 9 },
        { label: 'Heat', value: 3, max: 8 },
      ]}
      readOnly={readOnly}
      resume={resume}
      resolveScreen={null}
      opener={null}
      crewAttention={false}
      inbox={0}
      onSearch={noop}
      onMenu={noop}
      menu={null}
    />
  )
}

describe('DashboardPhone — the shell', () => {
  test('three unit tabs in a fixed order; a Minor’s problem is spelled out on its tab', () => {
    render(<Shell />)
    const tabs = within(screen.getByRole('tablist', { name: 'Units' })).getAllByRole('tab')
    expect(tabs.map((t) => t.textContent?.replace('▲', '').split(',')[0])).toEqual([
      'Pilot',
      'Mech',
      'Crawler',
    ])
    expect(screen.getByRole('tab', { name: /^Pilot\s*, needs attention$/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Mech' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { level: 2, name: 'Scrapper' })).toBeTruthy()
  })

  test('no masthead of its own: the bar returns to the Game hub', () => {
    render(<Shell />)
    expect(screen.getByRole('link', { name: 'Return to the Game hub' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Search the SRD' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Menu/ })).toBeTruthy()
  })

  test('pinned vitals sit under the tabs off the Major’s tab only (D8)', () => {
    const { unmount } = render(<Shell tab="mech" />)
    expect(screen.queryByRole('list', { name: 'Pinned vitals' })).toBeNull()
    unmount()
    render(<Shell tab="pilot" />)
    expect(screen.getByRole('list', { name: 'Pinned vitals' })).toBeTruthy()
  })

  test('read-only disables the controls and says why; the resume row still opens', () => {
    const onResume = mock(noop)
    render(<Shell readOnly="Read-only: offline." resume={{ name: 'Drill', onResume }} />)
    expect(screen.getByText('Read-only: offline.')).toBeTruthy()
    // One fieldset disables every control under the tabs.
    const control = screen.getByRole('button', { name: 'Scrapper control' })
    expect(control.closest('fieldset')?.disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Resolving · Drill/ }).closest('fieldset')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Resolving · Drill/ }))
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  test('a mount change takes focus to the new tab’s heading and announces it', () => {
    const { rerender } = render(<Shell tab="pilot" major="pilot" mountKey="pilot:" />)
    rerender(<Shell tab="mech" major="mech" mountKey="mech:m1" />)
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Scrapper' }))
    expect(screen.getByText('Boarded Scrapper')).toBeTruthy()
  })
})

const ACTION = (() => {
  const action = SalvageUnionReference.Actions.all()[0]
  if (!action) throw new Error('the reference set has no actions')
  return action
})()

function resolveModel(
  overrides: Partial<Extract<ResolveModel, { kind: 'resolve' }>> = {},
  controls: Partial<Extract<ResolveModel, { kind: 'resolve' }>['controls']> = {}
): ResolveModel {
  return {
    kind: 'resolve',
    onBack: noop,
    costLabel: '1 EP',
    currency: 'EP',
    entity: ACTION,
    controls: {
      activateLabel: 'Activate',
      activateDisabled: false,
      onActivate: noop,
      onRoll: noop,
      push: { disabled: false, pushed: false, onPush: noop },
      activated: false,
      applyLabel: 'Apply',
      applyDisabled: true,
      onApply: noop,
      onClear: noop,
      ...controls,
    },
    roll: null,
    pushLog: null,
    meltdown: null,
    applied: false,
    applyRouted: false,
    ...overrides,
  }
}

const ROLLED = {
  roll: 14,
  band: 'success',
  bandRange: '11–19',
  bandLabel: 'Success',
  bandSummary: 'You achieve your goal.',
  destructive: false,
}

/** The bottom bar's buttons, by their text. */
function bar(): string[] {
  return within(screen.getByRole('group', { name: 'Next step' }))
    .getAllByRole('button')
    .map((b) => b.textContent ?? '')
}

function renderResolve(view: ResolveModel) {
  return render(
    <PhoneResolve
      view={view}
      vitals={[{ label: 'Heat', value: 3, max: 8 }]}
      readOnly={null}
      onBack={noop}
      onTakeHit={noop}
    />
  )
}

describe('PhoneResolve — only the next step (D7)', () => {
  test('not activated: Activate with its cost', () => {
    renderResolve(resolveModel())
    expect(bar()).toEqual(['Activate · 1 EP'])
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Resolving' }))
  })

  test('activated: Roll the die', () => {
    renderResolve(resolveModel({}, { activated: true }))
    expect(bar()).toEqual(['Roll the die'])
  })

  test('rolled, a mech action: Push, then Apply with the band', () => {
    renderResolve(resolveModel({ roll: ROLLED }, { activated: true, applyDisabled: false }))
    expect(bar()).toEqual(['Push · Re-roll +2 Heat', 'Apply · Success'])
    expect(screen.getByText('11–19 · Success')).toBeTruthy()
  })

  test('pushed, or a pilot action: Apply alone', () => {
    const { unmount } = renderResolve(
      resolveModel(
        { roll: ROLLED, pushLog: 'Heat 5. Safe.' },
        {
          activated: true,
          applyDisabled: false,
          push: { disabled: true, pushed: true, onPush: noop },
        }
      )
    )
    expect(bar()).toEqual(['Apply · Success'])
    unmount()
    renderResolve(
      resolveModel(
        { roll: ROLLED, currency: 'AP' },
        { activated: true, applyDisabled: false, push: undefined }
      )
    )
    expect(bar()).toEqual(['Apply · Success'])
  })

  test('applied: Done', () => {
    renderResolve(resolveModel({ roll: ROLLED, applied: true }, { activated: true }))
    expect(bar()).toEqual(['Done'])
  })

  test('a Cascade Failure is confirmed before Apply hands it to the Major', async () => {
    const onApply = mock(noop)
    renderResolve(
      resolveModel(
        { roll: { ...ROLLED, band: 'cascade', bandLabel: 'Cascade Failure', destructive: true } },
        { activated: true, applyDisabled: false, onApply }
      )
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply · Cascade Failure' }))
    })
    expect(onApply).not.toHaveBeenCalled()
    const confirm = await screen.findByRole('alertdialog')
    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Take the hit' }))
    })
    expect(onApply).toHaveBeenCalledTimes(1)
  })
})
