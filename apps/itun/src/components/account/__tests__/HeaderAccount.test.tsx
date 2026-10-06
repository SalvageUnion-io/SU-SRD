import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { ConnectionProvider } from '../../../lib/connection/ConnectionProvider'
import { isConvexConfigured } from '../../../lib/connection/convexClient'
import { GamesMenu } from '../../container/GamesMenu'
import { AccountMenu } from '../AccountMenu'
import { HeaderActions, HeaderDrawerAccount, HeaderMobileActions } from '../HeaderAccount'

/**
 * The masthead's account slots in a Solo build — no `VITE_CONVEX_URL`, so no
 * Convex provider and no accounts at all.
 *
 * Every one of these components reaches for Convex hooks once it decides to
 * render, and each hook throws without a provider. Rendering here without a
 * throw is half the assertion; the other half is that they render NOTHING —
 * not a disabled sign-in, not an empty menu. A build that cannot have accounts
 * shows the masthead it always had.
 */

describe('header account slots in a Solo build', () => {
  test('the test build really is Solo', () => {
    // Asserted, not assumed: if this flips, the tests below would start
    // passing for an entirely different reason.
    expect(isConvexConfigured).toBe(false)
  })

  test.each([
    ['HeaderActions', <HeaderActions key="a" />],
    ['HeaderMobileActions', <HeaderMobileActions key="m" />],
    ['HeaderDrawerAccount', <HeaderDrawerAccount key="d" close={() => {}} />],
    ['AccountMenu', <AccountMenu key="am" />],
    ['GamesMenu', <GamesMenu key="g" />],
  ])('%s renders nothing', (_name, ui) => {
    const { container } = render(<ConnectionProvider>{ui}</ConnectionProvider>)
    expect(container.innerHTML).toBe('')
  })
})
