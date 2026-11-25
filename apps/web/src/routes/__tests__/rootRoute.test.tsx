/**
 * The root route's chrome, mounted under a real router signed out, in a body
 * that carries the shell's Union bar and skip link (`shell/unionBar.ts`): the
 * skip link's target, the bar's slots filled on every page but a Play screen
 * (which draws its own, ADR-051 §2) and hidden there, the footer, the default
 * tab title, and the bare `/og/*` picture surface with none of it.
 *
 * The root's own options are reused on a fresh root route, so the app's
 * generated route tree is never touched.
 */

import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { installServerMocks, setQueryAnswers } from '../../components/__tests__/serverMock'

// Module scope, before the imports below — see `serverMock.ts`. Signed out:
// the app's first paint for a visitor.
const serverMocks = await installServerMocks({
  authReact: { useSession: () => ({ isAuthenticated: false, isLoading: false }) },
})
afterAll(() => serverMocks.restore())

const { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } =
  await import('@tanstack/react-router')
const { Route } = await import('../__root')
const { pageTitle } = await import('../../lib/pageTitle')
const { renderUnionBar } = await import('../../shell/unionBar')
const { BAR_HIDDEN_ATTRIBUTE, slotSelector } = await import('../../shell/unionSlots')
const { activityStore } = await import('../../activity/activityStore')
const { SITE_URL } = await import('../../lib/constants')
const { APP_REWRITE } = await import('../../lib/appBase')

// The shell's markup, outside any container the preload's cleanup removes.
beforeEach(() => {
  document.body.innerHTML = renderUnionBar()
})
afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.removeAttribute(BAR_HIDDEN_ATTRIBUTE)
})

const barHidden = () => document.documentElement.hasAttribute(BAR_HIDDEN_ATTRIBUTE)
const searchSlot = () => document.querySelector(slotSelector('search'))

async function mountAt(path: string, onSite = false) {
  // The file route's options, typed for its own place in the generated tree.
  const root = createRootRoute(Route.options as unknown as Parameters<typeof createRootRoute>[0])
  const page = (text: string) => () => <p>{text}</p>
  const tree = root.addChildren([
    createRoute({ getParentRoute: () => root, path: '/', component: page('The roster') }),
    createRoute({
      getParentRoute: () => root,
      path: '/pilots/$id_/play',
      component: page('The Play screen'),
    }),
    createRoute({ getParentRoute: () => root, path: '/og/$id', component: page('The card') }),
  ])
  const router = createRouter({
    routeTree: tree,
    history: createMemoryHistory({ initialEntries: [path] }),
    // As the app mounts it: the site's paths in, its routes out (`APP_REWRITE`).
    ...(onSite ? { rewrite: APP_REWRITE } : {}),
  })
  setQueryAnswers({})
  await act(async () => {
    render(<RouterProvider router={router} />)
  })
  await screen.findByText(/^The (roster|Play screen|card)$/)
  return router
}

describe('the root route', () => {
  test('a page gets the skip link, the Union bar, its content and the footer', async () => {
    await mountAt('/')
    const skip = screen.getByRole('link', { name: 'Skip to content' })
    expect(skip.getAttribute('href')).toBe('#main-content')
    const target = document.getElementById('main-content')
    expect(target?.getAttribute('tabindex')).toBe('-1')
    expect(target?.textContent).toContain('The roster')
    expect(screen.getByRole('banner')).toBeTruthy()
    expect(barHidden()).toBe(false)
    // The app fills the bar's slots.
    expect(searchSlot()?.childElementCount).toBeGreaterThan(0)
    expect(screen.getByRole('contentinfo')).toBeTruthy()
  })

  test('the tab gets the default title', async () => {
    await mountAt('/')
    expect(document.title).toBe(pageTitle('Training Bay'))
  })

  test('a Play screen draws its own bar, so the Union bar and the foot step aside', async () => {
    await mountAt('/pilots/p1/play')
    expect(screen.getByText('The Play screen')).toBeTruthy()
    expect(barHidden()).toBe(true)
    expect(searchSlot()?.childElementCount).toBe(0)
    // The skip target stays; the foot goes, so the page never scrolls (play.md).
    expect(document.getElementById('main-content')).toBeTruthy()
    expect(screen.queryByRole('contentinfo')).toBeNull()
  })

  test('a link preview is the card alone: no bar, skip target or footer', async () => {
    await mountAt('/og/abc')
    expect(screen.getByText('The card')).toBeTruthy()
    expect(barHidden()).toBe(true)
    expect(screen.queryByRole('contentinfo')).toBeNull()
    expect(document.getElementById('main-content')).toBeNull()
  })
})

/** The test DOM's own address, which a test may move (happy-dom's `setURL`). */
const happyDOM = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM

describe('the root route in the Discord Activity', () => {
  const opened: string[] = []
  beforeEach(() => {
    opened.length = 0
    // Discord's proxy, where the Activity's frame is.
    happyDOM.setURL('https://1442878052823470172.discordsays.com/?frame_id=f&instance_id=i')
    const me = { id: '1', name: 'Rae', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png' }
    const crew = ['Kes', 'Vane', 'Wren', 'Ash', 'Moss'].map((name, i) => ({
      id: String(i + 2),
      name,
      avatarUrl: me.avatarUrl,
    }))
    activityStore.start({
      me,
      people: [me, ...crew],
      layout: 'focused',
      openOutside: (url) => opened.push(url),
    })
  })
  afterEach(() => {
    cleanup()
    activityStore.stop()
    happyDOM.setURL('about:blank')
    document.body.classList.remove('su-activity')
  })

  test('its own shell: the Activity bar and who is in it, no Union bar or foot', async () => {
    await mountAt('/')
    await screen.findByRole('button', { name: 'SalvageUnion.io' })
    expect(barHidden()).toBe(true)
    expect(document.body.classList.contains('su-activity')).toBe(true)
    expect(screen.queryByRole('contentinfo')).toBeNull()
    // Five faces, then a count of the rest.
    const faces = screen.getByRole('list', { name: 'At the table' })
    expect(faces.querySelectorAll('img')).toHaveLength(5)
    expect(faces.textContent).toContain('+1')
    expect(document.getElementById('main-content')?.textContent).toContain('The roster')
  })

  test('a link outside the app opens outside Discord; a route moves the router', async () => {
    const router = await mountAt('/build/', true)
    await screen.findByRole('button', { name: 'SalvageUnion.io' })
    const away = document.createElement('a')
    away.href = '/chassis/mule/'
    away.textContent = 'Mule'
    const route = document.createElement('a')
    route.href = '/build/pilots/p1/play'
    route.textContent = 'Play'
    document.body.append(away, route)
    fireEvent.click(away)
    expect(opened).toEqual([`${SITE_URL}/chassis/mule/`])
    await act(async () => {
      fireEvent.click(route)
    })
    await screen.findByText('The Play screen')
    expect(router.state.location.pathname).toBe('/pilots/p1/play')
    // A Play screen draws its own bar: the Activity bar gives way.
    expect(screen.queryByRole('button', { name: 'SalvageUnion.io' })).toBeNull()
    // Back from there, and home.
    await act(async () => {
      router.history.back()
    })
    await screen.findByText('The roster')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Back/ }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SalvageUnion.io' }))
    })
    expect(router.history.location.pathname).toBe('/games/')
  })
})
