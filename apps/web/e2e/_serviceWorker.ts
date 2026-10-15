import type { Page } from '@playwright/test'

/**
 * Whether a service worker registration becomes ACTIVE for the page's scope
 * within 15 s: the state a reload needs in order to be controlled.
 *
 * `page.evaluate` genuinely awaits a returned promise. `page.waitForFunction`
 * does NOT for an async predicate: it sees the Promise object, finds it truthy,
 * and resolves on the first poll, reporting "registered" at ~0 ms.
 *
 * Raced against a timer because a dev server emits no worker, so `ready` never
 * settles: an un-raced await would hang until the test timed out, turning
 * "this environment has no service worker" into a red test instead of a skip.
 */
export async function serviceWorkerReady(page: Page): Promise<boolean> {
  return await page
    .evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false
      const ready = navigator.serviceWorker.ready.then(() => true)
      const gaveUp = new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), 15_000)
      })
      return await Promise.race([ready, gaveUp])
    })
    .catch(() => false)
}
