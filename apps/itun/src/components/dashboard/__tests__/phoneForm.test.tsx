/**
 * The Dashboard's phone form (ADR-045).
 *
 *  - The switch reads both axes: a landscape phone gets the phone form too.
 *  - Browser zoom raises the floor, so a zoomed reader reaches it sooner,
 *    and the phone form's own scrollbar never reads as less zoom.
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
import type { Mech } from 'itun-domain/schemas/mech'
import type { Pilot } from 'itun-domain/schemas/pilot'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { mechFixture } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { DashboardCanvas } from '../DashboardCanvas'
import type { PhoneUnit } from '../DashboardPhone'
import { DashboardPhone } from '../DashboardPhone'
import {
  belowFloor,
  DashboardFormContext,
  isPhoneForm,
  layoutWidth,
  pageZoom,
  useUnitTab,
} from '../dashboardForm.model'
import type { MajorModel } from '../MajorFrame'
import { MajorFrame } from '../MajorFrame'
import { MechMajor } from '../MechSlot'
import { PhoneResolve } from '../PhoneResolve'
import type { ResolveModel } from '../ResolvePanel'
import type { PlayStore } from '../SlotRow'
import type { SlotKind } from '../slotLayout.model'
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

describe('browser zoom raises the floor (ADR-045 §7)', () => {
  // A 1920×1080 desktop with ~970px of viewport, at 100%, 125% and 150%:
  // zoom shrinks the CSS viewport, and the floor rises with the zoom.
  test('100% and 125% keep the canvas; 150% gets the phone form', () => {
    expect(isPhoneForm(1920, 970, 1)).toBe(false)
    expect(isPhoneForm(1920 / 1.25, 970 / 1.25, 1.25)).toBe(false)
    expect(isPhoneForm(1920 / 1.5, 970 / 1.5, 1.5)).toBe(true)
  })
  test('without the zoom, the same 150% viewport would keep the scaled-down canvas', () => {
    expect(isPhoneForm(1920 / 1.5, 970 / 1.5)).toBe(false)
  })
  test("a caller's own floor rises the same way", () => {
    expect(belowFloor(1280, 800, 0.8, 1)).toBe(false)
    expect(belowFloor(1280, 800, 0.8, 1.5)).toBe(true)
  })
  test('zooming out never lowers the floor', () => {
    expect(isPhoneForm(852, 393, 0.5)).toBe(true)
  })
})

describe('pageZoom — the zoom, snapped to a step and normalised against the display density (ADR-045 §7)', () => {
  test('100% reads 1 on a 1x and a Retina screen', () => {
    expect(pageZoom({ devicePixelRatio: 1, outerWidth: 1920, viewportWidth: 1920 })).toBe(1)
    expect(pageZoom({ devicePixelRatio: 2, outerWidth: 1440, viewportWidth: 1440 })).toBe(1)
  })
  test('150% reads 1.5 on a Retina screen, where devicePixelRatio alone reads 3', () => {
    expect(pageZoom({ devicePixelRatio: 3, outerWidth: 1440, viewportWidth: 960 })).toBe(1.5)
  })
  test('window chrome is not zoom: a frame or scrollbar a percent over reads 1', () => {
    expect(pageZoom({ devicePixelRatio: 1, outerWidth: 1936, viewportWidth: 1905 })).toBe(1)
  })
  test('devicePixelRatio caps it: a side panel on a 1x screen is not zoom', () => {
    expect(pageZoom({ devicePixelRatio: 1, outerWidth: 1920, viewportWidth: 1400 })).toBe(1)
    // Even one that happens to land on a zoom step: density 1 / 1.25 is no screen.
    expect(pageZoom({ devicePixelRatio: 1, outerWidth: 1920, viewportWidth: 1536 })).toBe(1)
  })
  test('a side panel on a Retina screen is not zoom', () => {
    // A 14-inch MacBook Pro (1512px) with a 400px side panel reads 1.36: no step.
    expect(pageZoom({ devicePixelRatio: 2, outerWidth: 1512, viewportWidth: 1112 })).toBe(1)
    // One that lands on 1.25 leaves a density of 1.6, which no screen ships with.
    expect(pageZoom({ devicePixelRatio: 2, outerWidth: 1440, viewportWidth: 1152 })).toBe(1)
    // A ~210px one lands on 1.15 and leaves 1.739, near 1.75 but not a quarter step.
    expect(pageZoom({ devicePixelRatio: 2, outerWidth: 1512, viewportWidth: 1300 })).toBe(1)
  })
  test("so a 13-inch MacBook Air's sidebar leaves the Mediator's canvas standing", () => {
    const zoom = pageZoom({ devicePixelRatio: 2, outerWidth: 1470, viewportWidth: 1270 })
    expect(zoom).toBe(1)
    expect(belowFloor(1270, 730, 0.8, zoom)).toBe(false)
  })
  test('docked devtools on a Retina screen are not zoom', () => {
    // 600px of devtools on the same 1512px window reads 1.66: no step.
    expect(pageZoom({ devicePixelRatio: 2, outerWidth: 1512, viewportWidth: 912 })).toBe(1)
  })
  test('vertical tabs on a 125% Windows display are not zoom', () => {
    expect(pageZoom({ devicePixelRatio: 1.25, outerWidth: 1536, viewportWidth: 1280 })).toBe(1)
  })
  test("so a side panel leaves the Mediator's 0.87 canvas standing", () => {
    const zoom = pageZoom({ devicePixelRatio: 2, outerWidth: 1512, viewportWidth: 1112 })
    expect(belowFloor(1112, 0.87 * 800, 0.8, zoom)).toBe(false)
  })
  test('real zoom through a Windows frame and scrollbar still snaps to its step', () => {
    // A 125% display at 150% zoom: 1536px window plus a 16px frame, a 17px scrollbar.
    expect(pageZoom({ devicePixelRatio: 1.875, outerWidth: 1552, viewportWidth: 1012 })).toBe(1.5)
  })
  test('a browser that hides its zoom, or a reading of nothing, reads 1', () => {
    expect(pageZoom({ devicePixelRatio: 2, outerWidth: 960, viewportWidth: 960 })).toBe(1)
    expect(pageZoom({ devicePixelRatio: 2, outerWidth: 0, viewportWidth: 0 })).toBe(1)
  })
  test('zooming out reads 1', () => {
    expect(pageZoom({ devicePixelRatio: 1.8, outerWidth: 1440, viewportWidth: 1600 })).toBe(1)
  })
})

describe("the phone form's scrollbar does not flip the form back (ADR-045 §7)", () => {
  // A 1x display at 150% zoom with collapsed vertical tabs (40px): the
  // viewport is (1920 − 40) / 1.5 = 1253 CSS px, a 1.532 reading, near the
  // top of the 1.5 step's slack (1.545). The phone form scrolls, and its
  // 17px scrollbar takes 11 CSS px off `clientWidth`: 1920 / 1242 = 1.546.
  const OUTER = 1920
  const VIEWPORT = 1253
  const SCROLLBAR = 11

  test('clientWidth alone would read the zoom off the step once the scrollbar shows', () => {
    const reading = (viewportWidth: number) =>
      pageZoom({ devicePixelRatio: 1.5, outerWidth: OUTER, viewportWidth })
    expect(reading(VIEWPORT)).toBe(1.5)
    expect(reading(VIEWPORT - SCROLLBAR)).toBe(1)
    // layoutWidth counts the scrollbar, so both forms read the same zoom.
    expect(reading(layoutWidth(VIEWPORT - SCROLLBAR, VIEWPORT))).toBe(1.5)
  })

  test('a pinch-zoom, which shrinks innerWidth, does not move the reading', () => {
    expect(layoutWidth(1253, 835)).toBe(1253)
  })

  test('DashboardCanvas settles on the phone form and stays there', () => {
    const phoneShowing = () => document.querySelector('.su-dash-phone') !== null
    // Each width read past this many means the forms are flipping: fail
    // instead of looping forever.
    let reads = 0
    const width = () => {
      reads += 1
      if (reads > 40) throw new Error('the Dashboard flipped between its forms')
      return VIEWPORT - (phoneShowing() ? SCROLLBAR : 0)
    }
    const proto = Object.getPrototypeOf(document.documentElement) as object
    const owner = [proto, HTMLElement.prototype, Element.prototype].find((p) =>
      Object.getOwnPropertyDescriptor(p, 'clientWidth')
    ) as object
    const clientWidth = Object.getOwnPropertyDescriptor(owner, 'clientWidth') as PropertyDescriptor
    const windowProps = ['devicePixelRatio', 'innerHeight', 'innerWidth', 'outerWidth'] as const
    const saved = windowProps.map((k) => [k, Object.getOwnPropertyDescriptor(window, k)] as const)
    const set = (k: string, value: number) =>
      Object.defineProperty(window, k, { configurable: true, value, writable: true })
    Object.defineProperty(owner, 'clientWidth', {
      configurable: true,
      get(this: Element) {
        if (this === document.documentElement || this.classList.contains('su-dash-root')) {
          return width()
        }
        return clientWidth.get?.call(this)
      },
    })
    set('devicePixelRatio', 1.5)
    set('outerWidth', OUTER)
    // innerWidth counts the scrollbar, so it holds in both forms.
    set('innerWidth', VIEWPORT)
    // 640 / 800 = 0.8: under 0.62 × 1.5, over 0.62 alone.
    set('innerHeight', 640)
    try {
      const formChanges: string[] = []
      const Form = ({ name }: { name: string }) => {
        formChanges.push(name)
        return <div>{name}</div>
      }
      const view = render(
        <DashboardCanvas phone={<Form name="phone" />}>
          <Form name="canvas" />
        </DashboardCanvas>
      )
      expect(phoneShowing()).toBe(true)
      expect(view.queryByText('canvas')).toBeNull()
      // The scrollbar's arrival re-measured the phone form and kept it.
      expect(formChanges.filter((f) => f === 'canvas').length).toBeLessThanOrEqual(1)
      expect(formChanges.at(-1)).toBe('phone')
      view.unmount()
    } finally {
      Object.defineProperty(owner, 'clientWidth', clientWidth)
      for (const [k, d] of saved) {
        if (d) Object.defineProperty(window, k, d)
        else delete (window as unknown as Record<string, unknown>)[k]
      }
    }
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

  for (const form of ['canvas', 'phone'] as const) {
    test(`${form}: a damaged entity chip greys and ends in the DAMAGED badge; an intact one has none`, () => {
      const bay = (name: string) => {
        const entity = SalvageUnionReference.getByNameIn('crawler-bays', name)
        if (!entity) throw new Error(`fixture missing: ${name}`)
        return entity
      }
      const view: MajorModel = {
        fam: 'crawler',
        stampLabel: 'Parked',
        bays: [
          {
            label: 'Bays',
            chips: [
              { text: 'Mech Bay', entity: bay('Mech Bay'), warn: true },
              { text: 'Storage Bay', entity: bay('Storage Bay') },
            ],
            buttons: [],
          },
        ],
      }
      const frame = <MajorFrame view={view} />
      const { container } = render(form === 'phone' ? <Phone>{frame}</Phone> : frame)
      const pills = Array.from(container.querySelectorAll('.su-entity-token__pill'))
      const pill = (name: string) => pills.find((p) => p.textContent?.includes(name))
      const damaged = pill('Mech Bay')?.querySelector('.su-entity-token__chips')
      expect(damaged?.lastElementChild?.textContent).toBe('Damaged')
      expect(pill('Storage Bay')?.textContent).not.toContain('Damaged')
    })
  }

  for (const form of ['canvas', 'phone'] as const) {
    test(`${form}: a prompt takes focus at its title, covers the bays, speaks, and gives focus back`, () => {
      function Prompted() {
        const [open, setOpen] = useState(false)
        const model = fixtureModel(() => setOpen(true))
        const overlay = {
          title: 'Reactor',
          onClose: () => setOpen(false),
          body: <p>Vented.</p>,
          announce: 'Vented, Heat 0.',
        }
        return <MajorFrame view={open ? { ...model, overlay } : model} />
      }
      const { container } = render(
        form === 'phone' ? (
          <Phone>
            <Prompted />
          </Phone>
        ) : (
          <Prompted />
        )
      )
      // The live region is there before any prompt, so its first words are heard.
      const live = container.querySelector('[aria-live="polite"]')
      expect(live?.textContent).toBe('')
      const vent = screen.getByRole('button', { name: 'Vent' })
      act(() => vent.focus())
      fireEvent.click(vent)

      const dialog = screen.getByRole('dialog', { name: 'Reactor' })
      expect(document.activeElement).toBe(within(dialog).getByText('Reactor'))
      expect(vent.closest('[inert]')).toBeTruthy()
      expect(live?.textContent).toBe('Vented, Heat 0.')

      fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(vent.closest('[inert]')).toBeNull()
      expect(document.activeElement).toBe(vent)
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
    // The bays and the deck are covered, not beside it: hidden and inert,
    // kept mounted so the opener can take focus back.
    expect(screen.queryByRole('button', { name: 'Vent' })).toBeNull()
    expect(screen.getByText('the deck').closest('[inert]')).toBeTruthy()
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
    cost: { amount: 1, heat: 0, uses: 0 },
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

/** What the bar says activating spends: its chips, then the cost box. */
function spend(): string[] {
  const group = screen.getByRole('group', { name: 'Next step' })
  return [...group.querySelectorAll('.su-stat-cell, .su-cost')].map((el) =>
    el.classList.contains('su-cost')
      ? (el.textContent ?? '')
      : [...el.children].map((part) => part.textContent).join(' ')
  )
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
    expect(bar()).toEqual(['Activate'])
    expect(spend()).toEqual(['1 EP'])
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Resolving' }))
  })

  test('the cost reads label-first chips, then the activation cost last (E17)', () => {
    renderResolve(resolveModel({ cost: { amount: 2, heat: 1, uses: 3 } }))
    expect(spend()).toEqual(['Heat +1', 'Uses 3', '2 EP'])
  })

  test('an action that spends nothing says so', () => {
    renderResolve(resolveModel({ cost: { amount: 0, heat: 0, uses: 0 } }))
    expect(bar()).toEqual(['Activate'])
    expect(spend()).toEqual([])
    expect(screen.getByText('No cost')).toBeTruthy()
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

  test('over the Heat Cap: Push is disabled and the bar says why', () => {
    const reason = 'No Push at Heat 7/8: +2 Heat would pass the Heat Capacity.'
    renderResolve(
      resolveModel(
        { roll: ROLLED },
        {
          activated: true,
          applyDisabled: false,
          push: { disabled: true, pushed: false, onPush: noop, lockedReason: reason },
        }
      )
    )
    const step = within(screen.getByRole('group', { name: 'Next step' }))
    expect(step.getByText(reason)).toBeTruthy()
    const push = step.getByRole('button', { name: 'Push · Re-roll +2 Heat' })
    expect((push as HTMLButtonElement).disabled).toBe(true)
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
