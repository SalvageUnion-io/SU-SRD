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
import { BlockedUpgradeError } from '../../../lib/db/index'
import { isBlockedUpgrade, savedWorkCopy } from '../../../lib/routeErrorCopy'
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

describe('savedWorkCopy says what an error does to the work, per backend', () => {
  test('a signed-in player is told their account holds it', () => {
    expect(savedWorkCopy('remote')).toMatch(/saved to your account/i)
    // Offline while signed in is still the account's data, just unreachable.
    expect(savedWorkCopy('blocked')).toMatch(/saved to your account/i)
  })

  test('an anonymous visitor is told the truth: a reload loses unsaved builds', () => {
    // The old copy promised everybody their data was "stored locally", which
    // is exactly wrong here — and the panel's own button is a reload.
    expect(savedWorkCopy('memory')).toMatch(/reloading loses them/i)
    expect(savedWorkCopy('memory')).not.toMatch(/stored locally/i)
  })

  test('only a build with the account gate off stores in the browser', () => {
    expect(savedWorkCopy('local')).toMatch(/stored in this browser/i)
  })
})

describe('isBlockedUpgrade', () => {
  test('matches the class, and the name when the class did not survive', () => {
    expect(isBlockedUpgrade(new BlockedUpgradeError())).toBe(true)
    expect(isBlockedUpgrade({ name: 'BlockedUpgradeError' })).toBe(true)
    expect(isBlockedUpgrade(new Error('other'))).toBe(false)
    expect(isBlockedUpgrade(null)).toBe(false)
  })
})

describe('a crash in one route leaves the app standing', () => {
  function mount(state: { fail: boolean }) {
    const rootRoute = createRootRoute({
      component: () => (
        <>
          <header>ITUN header</header>
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
    expect(screen.getByText('ITUN header')).toBeTruthy()
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
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).not.toMatch(/stored locally/i)
  })

  test('a blocked upgrade gets its own, self-serviceable copy', () => {
    render(
      <RootErrorComponent error={new BlockedUpgradeError()} reset={() => {}} info={undefined} />
    )

    expect(screen.getByText('Close the other tab')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
  })
})
