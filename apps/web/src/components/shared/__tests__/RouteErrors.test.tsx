import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import { savedWorkCopy } from '../../../lib/routeErrorCopy'
import { RootErrorComponent, RouteErrorComponent } from '../RouteErrors'

/**
 * The router's two error screens.
 *
 * The property that matters most is the one a unit test of the component alone
 * cannot show: that a crash inside ONE route leaves the rest of the app — the
 * header above it, and the way out — standing. That is why the middle block
 * mounts a real router rather than rendering the component with fake props.
 */

// React logs every error a boundary catches, and the router warns about each
// one in development; these tests throw on purpose.
const realConsoleError = console.error
const realConsoleWarn = console.warn
beforeEach(() => {
  console.error = () => {}
  console.warn = () => {}
})
afterEach(() => {
  console.error = realConsoleError
  console.warn = realConsoleWarn
})

describe('savedWorkCopy says what an error does to the work, per sync status', () => {
  test('a signed-in player is told their account holds it', () => {
    expect(savedWorkCopy('live')).toMatch(/saved to your account/i)
  })

  test('offline or still connecting names the account without assuming one', () => {
    // `syncing` comes before sign-in has resolved, so an
    // anonymous visitor can land here too — "your account" would be a guess.
    expect(savedWorkCopy('syncing')).toMatch(/saved to an account/i)
    expect(savedWorkCopy('syncing')).not.toMatch(/your account/i)
  })

  test('an anonymous visitor is told the truth: there is nothing a reload could lose', () => {
    // Signed out, nothing can be built (ADR-034 as amended), so the panel's own
    // reload button costs them nothing — and nothing is "stored locally".
    expect(savedWorkCopy('signedOut')).toMatch(/reloading loses nothing/i)
    expect(savedWorkCopy('signedOut')).not.toMatch(/stored locally/i)
  })

  test('no status ever claims the work is stored in this browser', () => {
    // No player's work lives only on the device, so no panel may say it does.
    for (const backend of ['live', 'offline', 'syncing', 'signedOut', null] as const) {
      expect(savedWorkCopy(backend)).not.toMatch(/in this browser/i)
    }
  })
})

describe('a crash in one route leaves the app standing', () => {
  function mount(state: { fail: boolean }) {
    const rootRoute = createRootRoute({
      component: () => (
        <>
          <header>app header</header>
          <Outlet />
        </>
      ),
      errorComponent: RootErrorComponent,
    })
    const pageRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        if (state.fail) throw new Error('route boom')
        return <p>The sheet</p>
      },
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([pageRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
      defaultErrorComponent: RouteErrorComponent,
    })
    render(<RouterProvider router={router} />)
  }

  test('the route shows its own error, and the header stays', async () => {
    mount({ fail: true })

    expect(await screen.findByText('This page hit an error')).toBeTruthy()
    expect(screen.getByText('app header')).toBeTruthy()
    // Not the root's full-page panel.
    expect(screen.queryByText('Something went wrong')).toBeNull()
  })

  test('"Try again" re-renders the route without a reload', async () => {
    const state = { fail: true }
    mount(state)
    await screen.findByText('This page hit an error')

    state.fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('The sheet')).toBeTruthy()
  })
})

describe('RootErrorComponent', () => {
  test('offers a reload, with copy that depends on where the work lives', () => {
    render(<RootErrorComponent error={new Error('boom')} reset={() => {}} info={undefined} />)

    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).not.toMatch(/stored locally/i)
  })
})
