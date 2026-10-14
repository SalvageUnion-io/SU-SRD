/**
 * The one way the repo's scripts start Chromium (`tools/shot.ts`,
 * `tools/gallery.ts`, the srd brand and og:image scripts).
 *
 * The browser is the pinned Playwright's own Chromium, or the cloud image's
 * (`FALLBACK_CHROME`) when that is not installed; `SHOT_CHROME_PATH` overrides
 * both. Playwright is imported lazily so a caller that never launches pays
 * nothing for it.
 */
import { existsSync } from 'node:fs'
import type { LaunchOptions } from '@playwright/test'

/** The cloud image's Chromium, older than the pinned Playwright's (`docs/ops/cloud-environment.md`). */
const FALLBACK_CHROME = '/opt/pw-browsers/chromium'

/** The executable to launch: `SHOT_CHROME_PATH`, Playwright's own, the fallback, or Playwright's default. */
export function chromeExecutable(own: string): string | undefined {
  const override = process.env.SHOT_CHROME_PATH
  if (override) return override
  if (existsSync(own)) return undefined
  return existsSync(FALLBACK_CHROME) ? FALLBACK_CHROME : undefined
}

/** Launches Chromium with `options`, choosing the executable as `chromeExecutable` does. */
export async function launchBrowser(options: LaunchOptions = {}) {
  const { chromium } = await import('@playwright/test')
  return chromium.launch({
    ...options,
    executablePath: chromeExecutable(chromium.executablePath()),
  })
}
