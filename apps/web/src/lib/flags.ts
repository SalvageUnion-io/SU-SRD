import { SITE_URL } from './constants'
import { originOf } from './site'

/**
 * Feature flags (ADR-053): an unfinished surface ships behind one, off in
 * production and on everywhere else, so a branch can merge with it dark.
 *
 * Each entry names a flag and what it hides. A flag is a build-time constant:
 * no per-account, per-request or remote toggle. The PR that finishes a surface
 * deletes its entry and every `flagOn` that read it.
 */
export const FLAGS = {} as const satisfies Record<string, string>

export type Flag = keyof typeof FLAGS

/**
 * Whether flagged surfaces show on a build served from `origin`: never on
 * production's origin, always on a Worker Preview's or the dev server's. A
 * build with the test sign-in seam never deploys (`TestAuthBridge`), so it
 * shows them too, and the e2e suites cover them before they ship.
 */
export function flagsOnAt(origin: string, testBuild = false): boolean {
  return testBuild || originOf(origin) !== originOf()
}

const on = flagsOnAt(SITE_URL, import.meta.env.VITE_TEST_AUTH === 'true')

/** Whether the surface behind `flag` shows in this build. */
export function flagOn(_flag: Flag): boolean {
  return on
}
