/**
 * The build and sheet routes' own wiring, through the app's real route tree:
 * which search params each `/…/new` route keeps and hands its wizard (a deep
 * link's chassis, pattern, class or crawler type — dropped when it names
 * nothing legal), where each callback navigates, the NPC designer's view and
 * crew in the URL, and `/sheet/$kind/$id` choosing its page or saying the kind
 * is not a sheet. Also `/mechs/patterns/new` and `/dashboard/$pilotId`.
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
    '../wizard/NewEntityScreen': () => ({
      NewEntityScreen: (p: Props) =>
        h(
          'div',
          null,
          h('p', null, `${String(p.kind)} screen, mode ${named(p.mode)}`),
          h('p', null, `return to ${named(p.returnTo)}`),
          p.wizard as ReactNode,
          call('Choose blank', () => (p.onModeChange as (m: string) => void)('blank')),
          call('Created', () => (p.onCreated as (id: string) => void)('new-id'))
        ),
    }),
    '../mech/MechWizard': () => ({
      MechWizard: wizardStub(
        'Mech wizard',
        (p) =>
          `${named(p.preselectChassis)} / ${named((p.preselectPattern as { name?: string } | undefined)?.name)}`
      ),
    }),
    '../pilot/PilotWizard': () => ({
      PilotWizard: wizardStub('Pilot wizard', (p) => (p.preselectClassId ? 'a class' : 'none')),
    }),
    '../crawler/CrawlerBuilder': () => ({
      CrawlerBuilder: wizardStub('Crawler builder', (p) => named(p.preselectType)),
    }),
    '../npc/NpcDesignerPage': () => ({
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
    '../sheet/SheetView': () => ({
      SheetView: (p: Props) => h('p', null, `Live sheet: ${String(p.kind)} ${String(p.id)}`),
    }),
    '../npc/NpcSheetView': () => ({
      NpcSheetView: (p: Props) => h('p', null, `NPC sheet: ${String(p.id)}`),
    }),
    '../mech/Pattern/SavePatternPage': () => ({
      SavePatternPage: (p: Props) =>
        h(
          'section',
          { 'aria-label': 'Save pattern' },
          h('p', null, `saving from ${String(p.mechId) || 'none'}`),
          call('Saved private', () =>
            (p.onSaved as (id: string, v: string) => void)('pat-1', 'private')
          ),
          call('Saved public', () =>
            (p.onSaved as (id: string, v: string) => void)('pat-2', 'public')
          ),
          call('Cancel save', p.onCancel as () => void)
        ),
    }),
    '../dashboard/DashboardGate': () => ({
      DashboardGate: (p: Props) => h('p', null, `Dashboard gate for ${String(p.id)}`),
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
    expect(at(router).pathname).toBe('/sheet/mech/new-id')
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
    expect(at(router).pathname).toBe('/sheet/pilot/new-id')
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
    expect(at(router).pathname).toBe('/sheet/crawler/new-id')
  })

  test('the builder finishing goes back to the Hangar', async () => {
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
    expect(at(router).pathname).toBe('/sheet/npc/npc-7')
    expect(await screen.findByText('NPC sheet: npc-7')).toBeTruthy()
    await go(router, '/npcs/new')
    await press('Cancel design')
    expect(at(router).pathname).toBe('/')
  })

  test('the screen around the designer can also open a created NPC', async () => {
    const router = await mountAt('/npcs/new')
    expect(await screen.findByText('npc screen, mode guided')).toBeTruthy()
    await press('Created')
    expect(at(router).pathname).toBe('/sheet/npc/new-id')
  })
})

describe('/sheet/$kind/$id', () => {
  test('a pilot, mech or crawler is the Live Sheet', async () => {
    await mountAt('/sheet/crawler/c1')
    expect(await screen.findByText('Live sheet: crawler c1')).toBeTruthy()
  })

  test('a kind that is not a sheet says so', async () => {
    await mountAt('/sheet/dropship/x1')
    expect(await screen.findByText('Sheet not found')).toBeTruthy()
    expect(screen.getByText(/“dropship” is not a sheet type\./)).toBeTruthy()
  })
})

describe('/mechs/patterns/new', () => {
  test('saves from the mech in the URL; a private pattern goes home', async () => {
    const router = await mountAt('/mechs/patterns/new?from=m1')
    expect(await screen.findByText('saving from m1')).toBeTruthy()
    await press('Saved private')
    expect(at(router).pathname).toBe('/')
  })

  test('a shared pattern opens its public page', async () => {
    // The public page it lands on asks for the pattern; this one is not shared.
    const router = await mountAt('/mechs/patterns/new?from=m1', { 'publicSheet:pattern': null })
    await press('Saved public')
    expect(at(router).pathname).toBe('/p/pattern/pat-2')
  })

  test('cancel goes back to the mech it came from, or home with none', async () => {
    const router = await mountAt('/mechs/patterns/new?from=m1')
    await press('Cancel save')
    expect(at(router).pathname).toBe('/sheet/mech/m1')

    await go(router, '/mechs/patterns/new')
    expect(await screen.findByText('saving from none')).toBeTruthy()
    await press('Cancel save')
    expect(at(router).pathname).toBe('/')
  })
})

describe('/dashboard/$pilotId', () => {
  test("hands the pilot's id to the gate", async () => {
    await mountAt('/dashboard/p1')
    expect(await screen.findByText('Dashboard gate for p1')).toBeTruthy()
  })
})
