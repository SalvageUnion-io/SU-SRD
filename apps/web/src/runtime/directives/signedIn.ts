/**
 * `client:signedIn` — Astro's directive for the account islands: they
 * hydrate in an idle moment, and only while somebody is signed in
 * (`lib/accountBar.ts`). A signed-out reader never loads them, and the
 * island says so (`data-island-skipped`) for a scan that waits on islands.
 *
 * Registered by `astro/build/islandDirectives.ts`, and inlined by Astro.
 */

import type { ClientDirective } from 'astro'
import { readAccountHint } from '../../lib/accountHint'
import { browserStorage } from '../../lib/accountState'

/** As Astro's `client:idle={{ timeout }}` (`Islands.astro`). */
const IDLE_TIMEOUT_MS = 2000

const signedIn: ClientDirective = (load, _options, el) => {
  if (readAccountHint(browserStorage()) === null) {
    el.dataset.islandSkipped = ''
    return
  }
  const hydrate = async () => {
    const run = await load()
    await run()
  }
  if ('requestIdleCallback' in window)
    window.requestIdleCallback(() => void hydrate(), { timeout: IDLE_TIMEOUT_MS })
  else setTimeout(() => void hydrate(), 200)
}

/** Astro loads it by path (`astro/build/islandDirectives.ts`). @public */
export default signedIn
