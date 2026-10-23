/**
 * The build and sheet routes' own wiring, through the app's real route tree:
 * which search params each `/…/new` route keeps and hands its wizard (a deep
 * link's chassis, pattern, class or crawler type — dropped when it names
 * nothing legal), where each callback navigates, the NPC designer's view and
 * crew in the URL, and each sheet route (`/pilots/$id`, …) handing its kind and
 * id to its page. Also Play's screens.
 *
 * The screens themselves have their own suites, so each is replaced here by a
 * stub that shows what the route handed it and offers the route's callbacks as
 * buttons. Signed out, as in `rootRoute.test.tsx`.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { installConvexMocks, setQueryAnswers } from '../../components/__tests__/convexMock'

const h = createElement

type Props = Record<string, unknown>

/** A stub button that runs one of the route's callbacks. */
function call(label: string, run: () => void) {
  return h('button', { type: 'button', onClick: run }, label)
}

const named = (value: unknown): string =>
  value === undefined ? 'none' : typeof value === 'string' ? value : JSON.stringify(value)

/** A wizard stub: what it was preselected with, and its three ways out. */
function wizardStub(name: string, preselect: (p: Props) => string) {
  return (p: Props) =>
    h(
      'section',
      { 'aria-label': name },
      h('p', null, `${name} preselect: ${preselect(p)}`),
      h('p', null, `${name} game: ${named(p.gameId)}`),
      call(`${name}: cancel`, p.onCancel as () => void),
      call(`${name}: off rules`, p.onOffRules as () => void),
      call(`${name}: complete`, p.onComplete as () => void)
    )
}

// Module scope, before the route tree is imported — see `convexMock.ts`.
// Specifiers in `also` resolve relative to `convexMock.ts`.
const convexMocks = await installConvexMocks({
  authReact: true,
  convexReact: { useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }) },
  also: {
    '../../build/wizard/NewEntityScreen': () => ({
      NewEntityScreen: (p: Props) =>
        h(
          'div',
          null,
          h('p', null, `${String(p.kind)} screen, mode ${named(p.mode)}`),
          h('p', null, `return to ${named(p.returnTo)}`),
          h('p', null, `blank lands in ${named(p.gameId)}`),
          p.wizard as ReactNode,
          call('Choose blank', () => (p.onModeChange as (m: string) => void)('blank')),
          call('Created', () => (p.onCreated as (id: string) => void)('new-id'))
        ),
    }),
    '../../build/mech/MechWizard': () => ({
      MechWizard: wizardStub(
        'Mech wizard',
        (p) =>
          `${named(p.preselectChassis)} / ${named((p.preselectPattern as { name?: string } | undefined)?.name)}`
      ),
    }),
    '../../build/pilot/PilotWizard': () => ({
      PilotWizard: wizardStub('Pilot wizard', (p) => (p.preselectClassId ? 'a class' : 'none')),
    }),
    '../../build/crawler/CrawlerWizard': () => ({
      CrawlerWizard: wizardStub('Crawler builder', (p) => named(p.preselectType)),
    }),
    '../../build/npc/NpcDesignerPage': () => ({
      NpcDesignerPage: (p: Props) =>
        h(
          'section',
          { 'aria-label': 'NPC designer' },
          h(
            'p',
            null,
            `view ${named(p.view)}, crawler ${named(p.crawlerId)}, slot ${named(p.slot)}`
          ),
          call('Any NPC', () => (p.onViewChange as (v: string) => void)('any')),
          call('Crew view', () => (p.onViewChange as (v: string) => void)('crew')),
          call('Pick a crew slot', () =>
            (p.onCrewSelect as (n: { crawler?: string; slot?: string }) => void)({
              crawler: 'c9',
              slot: 'command-bay',
            })
          ),
          call('Designed', () => (p.onCreated as (id: string) => void)('npc-7')),
          call('Cancel design', p.onCancel as () => void)
        ),
    }),
    '../../build/sheet/SheetView': () => ({
      SheetView: (p: Props) => h('p', null, `Live sheet: ${String(p.kind)} ${String(p.id)}`),
    }),
    '../../build/npc/NpcSheetView': () => ({
      NpcSheetView: (p: Props) => h('p', null, `NPC sheet: ${String(p.id)}`),
    }),
    '../../play/PlayGate': () => ({
      PlayGate: (p: Props) => h('p', null, `Play gate for ${String(p.id)}`),
    }),
    '../../play/games/GamePage': () => ({
      GamePage: (p: Props) => h('p', null, `Game page for ${String(p.gameId)}`),
    }),
    '../../play/PlayMediatorGate': () => ({
      PlayMediatorGate: (p: Props) => h('p', null, `Mediate gate for ${String(p.gameId)}`),
    }),
  },
})
afterAll(() => convexMocks.restore())

const { createMemoryHistory, createRouter, RouterProvider } = await import('@tanstack/react-router')
const { routeTree } = await import('../../routeTree.gen')

type AppRouter = ReturnType<typeof createRouter>

async function mountAt(path: string, answers: Record<string, unknown> = {}): Promise<AppRouter> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  }) as unknown as AppRouter
  setQueryAnswers(answers)
  await act(async () => {
    render(<RouterProvider router={router} />)
  })
  return router
}

/** Where the router is now: the path, and the search its route validated. */
function at(router: AppRouter) {
  const search = router.state.matches.at(-1)?.search ?? {}
  return { pathname: router.state.location.pathname, search: search as Record<string, unknown> }
}

async function go(router: AppRouter, path: string) {
  await act(async () => {
    router.history.push(path)
  })
}

async function press(name: string) {
  await act(async () => {
    fireEvent.click(await screen.findByRole('button', { name }))
  })
}

describe('/mechs/new', () => {
  test('keeps a legal chassis and its pattern from a deep link, and hands both to the wizard', async () => {
    await mountAt('/mechs/new?mode=guided&chassis=mule&pattern=hauler')
    expect(await screen.findByText('mech screen, mode guided')).toBeTruthy()
    expect(screen.getByText('Mech wizard preselect: mule / Hauler')).toBeTruthy()
    expect(screen.getByText(/^return to \/mechs\/new\?/)).toBeTruthy()
  })

  test('drops a chassis that names nothing, and a mode it does not know', async () => {
    await mountAt('/mechs/new?mode=sideways&chassis=Not%20A%20Slug')
    expect(await screen.findByText('mech screen, mode none')).toBeTruthy()
    expect(screen.getByText('Mech wizard preselect: none / none')).toBeTruthy()
  })

  test('choosing a mode keeps the deep link; off rules goes to blank; created opens the sheet', async () => {
    const router = await mountAt('/mechs/new?chassis=mule')
    await press('Choose blank')
    expect(at(router)).toEqual({
      pathname: '/mechs/new',
      search: { chassis: 'mule', mode: 'blank' },
    })
    await press('Mech wizard: off rules')
    expect(at(router).search).toEqual({ mode: 'blank' })
    await press('Created')
    expect(at(router).pathname).toBe('/mechs/new-id')
    expect(await screen.findByText('Live sheet: mech new-id')).toBeTruthy()
  })
})

describe('/pilots/new', () => {
  test('a core class from a deep link reaches the wizard; the callbacks navigate', async () => {
    const router = await mountAt('/pilots/new?mode=guided&class=hacker')
    expect(await screen.findByText('pilot screen, mode guided')).toBeTruthy()
    expect(screen.getByText('Pilot wizard preselect: a class')).toBeTruthy()
    await press('Choose blank')
    expect(at(router).search).toEqual({ class: 'hacker', mode: 'blank' })
    await press('Pilot wizard: off rules')
    expect(at(router).search).toEqual({ mode: 'blank' })
    await press('Created')
    expect(at(router).pathname).toBe('/pilots/new-id')
  })

  test('a class slug that names no class is dropped', async () => {
    await mountAt('/pilots/new?mode=guided&class=astronaut')
    expect(await screen.findByText('Pilot wizard preselect: none')).toBeTruthy()
  })
})

describe('/crawlers/new', () => {
  test('a crawler type from a deep link reaches the builder; the callbacks navigate', async () => {
    const router = await mountAt('/crawlers/new?mode=guided&type=battle')
    expect(await screen.findByText('crawler screen, mode guided')).toBeTruthy()
    expect(screen.getByText('Crawler builder preselect: battle')).toBeTruthy()
    await press('Choose blank')
    expect(at(router).search).toEqual({ type: 'battle', mode: 'blank' })
    await press('Crawler builder: off rules')
    expect(at(router).search).toEqual({ mode: 'blank' })
    await press('Created')
    expect(at(router).pathname).toBe('/crawlers/new-id')
  })

  test('the builder finishing goes back to the Training Bay', async () => {
    const router = await mountAt('/crawlers/new?mode=guided&type=no-such-type')
    expect(await screen.findByText('Crawler builder preselect: none')).toBeTruthy()
    await press('Crawler builder: complete')
    expect(at(router).pathname).toBe('/')
  })
})

describe('/npcs/new', () => {
  test('opens on any NPC, and crew mode carries the crawler and slot', async () => {
    await mountAt('/npcs/new')
    expect(await screen.findByText('view any, crawler none, slot none')).toBeTruthy()
  })

  test('the crew link from a crawler sheet lands in crew view for that crawler and slot', async () => {
    await mountAt('/npcs/new?view=crew&crawler=c1&slot=galley')
    expect(await screen.findByText('view crew, crawler c1, slot galley')).toBeTruthy()
  })

  test('switching view keeps the crawler only in crew view, and picking a slot puts it in the URL', async () => {
    const router = await mountAt('/npcs/new?view=crew&crawler=c1&slot=galley')
    await press('Crew view')
    expect(at(router).search).toEqual({ view: 'crew', crawler: 'c1' })
    await press('Pick a crew slot')
    expect(at(router).search).toEqual({ view: 'crew', crawler: 'c9', slot: 'command-bay' })
    await press('Any NPC')
    expect(at(router).search).toEqual({ view: 'any' })
  })

  test('a designed NPC opens its sheet; cancel goes home', async () => {
    const router = await mountAt('/npcs/new')
    await press('Designed')
    expect(at(router).pathname).toBe('/npcs/npc-7')
    expect(await screen.findByText('NPC sheet: npc-7')).toBeTruthy()
    await go(router, '/npcs/new')
    await press('Cancel design')
    expect(at(router).pathname).toBe('/')
  })

  test('the screen around the designer can also open a created NPC', async () => {
    const router = await mountAt('/npcs/new')
    expect(await screen.findByText('npc screen, mode guided')).toBeTruthy()
    await press('Created')
    expect(at(router).pathname).toBe('/npcs/new-id')
  })
})

describe('a sheet route', () => {
  for (const kind of ['pilot', 'mech', 'crawler'] as const) {
    test(`/${kind}s/$id is the Live Sheet of that kind`, async () => {
      await mountAt(`/${kind}s/x1`)
      expect(await screen.findByText(`Live sheet: ${kind} x1`)).toBeTruthy()
    })
  }

  test('/npcs/$id is the NPC sheet', async () => {
    await mountAt('/npcs/n1')
    expect(await screen.findByText('NPC sheet: n1')).toBeTruthy()
  })
})

describe('/play/pilots/$pilotId', () => {
  test("hands the pilot's id to the gate", async () => {
    await mountAt('/play/pilots/p1')
    expect(await screen.findByText('Play gate for p1')).toBeTruthy()
  })
})

describe('/play/games/$gameId', () => {
  test("hands the Game's id to its page", async () => {
    await mountAt('/play/games/g1')
    expect(await screen.findByText('Game page for g1')).toBeTruthy()
  })
})

describe('a wizard started from a Game’s page (`?game=`, ADR-052 §3)', () => {
  for (const [path, name] of [
    ['/pilots/new', 'Pilot wizard'],
    ['/mechs/new', 'Mech wizard'],
    ['/crawlers/new', 'Crawler builder'],
  ] as const) {
    test(`${path}: the unit lands in that Game, and finishing returns to its page`, async () => {
      const router = await mountAt(`${path}?mode=guided&game=g1`)
      expect(await screen.findByText(`${name} game: g1`)).toBeTruthy()
      expect(screen.getByText('blank lands in g1')).toBeTruthy()
      await press(`${name}: complete`)
      expect(at(router).pathname).toBe('/play/games/g1')
    })
  }

  test('cancelling returns to the Game’s page; off rules and the mode keep the Game', async () => {
    const router = await mountAt('/pilots/new?game=g1')
    await press('Choose blank')
    expect(at(router).search).toEqual({ game: 'g1', mode: 'blank' })
    await press('Pilot wizard: off rules')
    expect(at(router).search).toEqual({ game: 'g1', mode: 'blank' })
    await press('Pilot wizard: cancel')
    expect(at(router).pathname).toBe('/play/games/g1')
  })

  test('a game param that is not an id is dropped', async () => {
    await mountAt('/pilots/new?mode=guided&game=not-an-id!')
    expect(await screen.findByText('Pilot wizard game: none')).toBeTruthy()
  })
})

describe('/play/games/$gameId/mediate', () => {
  test("hands the Game's id to the Mediator's gate", async () => {
    await mountAt('/play/games/g1/mediate')
    expect(await screen.findByText('Mediate gate for g1')).toBeTruthy()
  })
})
