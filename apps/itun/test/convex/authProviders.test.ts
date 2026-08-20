/**
 * The gate on the test-only password provider.
 *
 * ADR-034 keeps **Discord as the only door** for real users. A password
 * provider exists solely so a Playwright fixture can sign in — without it the
 * anonymous-build → sign-in → save hand-off, which is the step most likely to
 * lose somebody's work, has no end-to-end cover at all.
 *
 * That makes this file the price of admission. A second way into an account is
 * only acceptable if it demonstrably cannot be reached in production, and
 * "demonstrably" means an assertion that can fail — not a comment saying the
 * env var is not set. Comments do not fail.
 *
 * **If these tests are ever deleted or weakened, delete the provider too.** The
 * provider and this file are one change; keeping one without the other is
 * exactly the ungated second door the plan refused to ship.
 */

import { describe, expect, test } from 'bun:test'
import { providersFor } from '../../convex/auth'

/** Auth.js/Convex providers expose a stable string `id`. */
function idsOf(providers: ReturnType<typeof providersFor>): string[] {
  return providers.map((p) => (p as { id?: string }).id ?? '<unnamed>')
}

describe('a deployment without ITUN_TEST_AUTH has exactly one door', () => {
  test('production exposes Discord and nothing else', () => {
    const ids = idsOf(providersFor(false))

    // Length AND contents. Asserting only "contains discord" would pass with a
    // password provider sitting quietly beside it, which is the whole failure
    // this test exists to catch.
    expect(ids).toEqual(['discord'])
  })

  test('the password provider is genuinely absent, not merely last', () => {
    const ids = idsOf(providersFor(false))
    // `'credentials'`, not `'password'`: `Password()` is built on
    // ConvexCredentials and inherits that id. Worth pinning by its real id —
    // asserting the absence of a name nothing ever had would pass forever.
    expect(ids).not.toContain('credentials')
  })
})

describe('a test deployment gets the extra provider', () => {
  test('Discord is still there — the bypass ADDS, it never replaces', () => {
    // If enabling test auth removed Discord, a test deployment would stop
    // exercising the real sign-in path and the fixture would be testing
    // something no user ever does.
    expect(idsOf(providersFor(true))).toContain('discord')
  })

  test('password is available when the flag is on', () => {
    expect(idsOf(providersFor(true))).toContain('credentials')
  })

  test('exactly one provider is added, and it is the password one', () => {
    // A negative control on the control: this is what proves the two branches
    // actually differ, so the production assertion above is not passing
    // vacuously against a function that ignores its argument.
    const prod = idsOf(providersFor(false))
    const testing = idsOf(providersFor(true))

    expect(testing.length).toBe(prod.length + 1)
    expect(testing.filter((id) => !prod.includes(id))).toEqual(['credentials'])
  })
})

describe('the flag is exact-match, not truthy', () => {
  test("only the string 'true' enables it", () => {
    // `providersFor` takes a boolean, so this pins the *reading* of the env var
    // rather than the branch: `ITUN_TEST_AUTH === 'true'` and nothing looser.
    // A truthy check would turn `ITUN_TEST_AUTH=false` — a plausible thing for
    // somebody to set while trying to disable it — into an enabled bypass.
    const source = Bun.file(new URL('../../convex/auth.ts', import.meta.url).pathname)
    const text = source.text()
    return text.then((t) => {
      expect(t).toContain("process.env.ITUN_TEST_AUTH === 'true'")
      // Neither a bare truthiness check nor a not-equals inversion.
      expect(t).not.toContain('process.env.ITUN_TEST_AUTH !==')
      expect(t).not.toMatch(/if\s*\(\s*process\.env\.ITUN_TEST_AUTH\s*\)/)
    })
  })
})
