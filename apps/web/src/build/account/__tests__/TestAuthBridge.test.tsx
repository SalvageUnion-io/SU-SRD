/**
 * The gate on the test sign-in seam.
 *
 * `TestAuthBridge` puts a function on `window` that signs in with the password
 * provider. That is only acceptable because it cannot reach production, and
 * "cannot" has to be an assertion rather than a comment — comments do not fail.
 *
 * Two independent flags have to be wrong at once for the seam to be reachable:
 * `VITE_TEST_AUTH` in the build (this file) and `TEST_AUTH` on the
 * deployment (`test/convex/__tests__/authProviders.test.ts`). Each is pinned separately so
 * neither can drift into the other's blind spot.
 */

import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { TestAuthBridge } from '../TestAuthBridge'
import { TEST_SIGN_IN_GLOBAL, testAuthBridgeEnabled } from '../testAuthSeam.model'

describe('the seam is off unless a build asks for it', () => {
  test('the flag defaults to off', () => {
    // `VITE_TEST_AUTH` is unset here, in CI, and in every committed env file. If this
    // ever reads true, a production bundle is carrying an auth bypass.
    expect(testAuthBridgeEnabled).toBe(false)
  })

  test('rendering it registers nothing', () => {
    render(<TestAuthBridge />)

    // The observable consequence, not just the flag: with the flag off there is
    // no function on `window` for anything to call.
    expect((window as unknown as Record<string, unknown>)[TEST_SIGN_IN_GLOBAL]).toBeUndefined()
  })

  test('it renders nothing at all', () => {
    const { container } = render(<TestAuthBridge />)
    expect(container.innerHTML).toBe('')
  })
})

describe('the global name is shared, not retyped', () => {
  test('the e2e spec and the bridge agree on it', async () => {
    // The fixture calls this by name from inside `page.evaluate`, where a typo
    // would surface as "seam not present" and silently SKIP the test rather
    // than fail it. Pinning the string here is what stops a rename turning the
    // hand-off spec into a permanent no-op.
    expect(TEST_SIGN_IN_GLOBAL).toBe('__appTestSignIn')

    // `gates/lib/testSignIn.ts` is what calls the seam (the e2e fixtures, the
    // gallery and dev-backend seed, `bun run shot`), and it carries its own
    // copy of the name and signature because Playwright code and the tools
    // cannot import app source that reads `import.meta.env`.
    const caller = await Bun.file(
      new URL('../../../../../../packages/gates/lib/testSignIn.ts', import.meta.url).pathname
    ).text()
    expect(caller).toContain(`'${TEST_SIGN_IN_GLOBAL}'`)
    // And the same signature as the bridge's own.
    const flow = `flow?: 'signUp' | 'signIn'`
    const bridge = await Bun.file(new URL('../TestAuthBridge.tsx', import.meta.url).pathname).text()
    expect(bridge).toContain(flow)
    expect(caller).toContain(flow)
  })
})
