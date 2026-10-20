/**
 * The one way the repo's scripts start Chromium (`tools/shot.ts`,
 * `tools/gallery.ts`, the srd brand and og:image scripts).
 *
 * The browser is the pinned Playwright's own Chromium; else the
 * chrome-headless-shell in this checkout's `.pw-browsers/` (`CHECKOUT_BROWSERS`,
 * what `bun run dev:backend` installs where a sandbox refuses the full
 * Chromium's singleton socket: a Remote Control sandbox); else the cloud
 * image's (`FALLBACK_CHROME`). `SHOT_CHROME_PATH` overrides them all. Playwright is imported lazily so a caller that never launches pays
 * nothing for it.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { LaunchOptions } from '@playwright/test'
import { CHECKOUT_ROOT } from './ports'

/** The cloud image's Chromium, older than the pinned Playwright's (`docs/ops/cloud-environment.md`). */
const FALLBACK_CHROME = '/opt/pw-browsers/chromium'

/** Where this checkout keeps a Playwright browser of its own (`PLAYWRIGHT_BROWSERS_PATH` for an install). */
export const CHECKOUT_BROWSERS = join(CHECKOUT_ROOT, '.pw-browsers')

/** The newest chrome-headless-shell installed under `dir`, or undefined. */
export function headlessShell(dir = CHECKOUT_BROWSERS): string | undefined {
  if (!existsSync(dir)) return undefined
  for (const revision of readdirSync(dir)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse()) {
    for (const platform of readdirSync(join(dir, revision))) {
      const binary = join(dir, revision, platform, 'chrome-headless-shell')
      if (existsSync(binary)) return binary
    }
  }
  return undefined
}

/**
 * The executable to launch: `SHOT_CHROME_PATH`, Playwright's own, this
 * checkout's headless shell, the fallback, or Playwright's default.
 */
export function chromeExecutable(own: string, browsers = CHECKOUT_BROWSERS): string | undefined {
  const override = process.env.SHOT_CHROME_PATH
  if (override) return override
  if (existsSync(own)) return undefined
  const shell = headlessShell(browsers)
  if (shell) return shell
  return existsSync(FALLBACK_CHROME) ? FALLBACK_CHROME : undefined
}

/**
 * Run in a page before its scripts: a sandbox without netlink makes Chromium
 * report itself offline, and the app then never talks to its backend.
 */
export const FORCE_ONLINE = `Object.defineProperty(Navigator.prototype, 'onLine', { get: () => true })`

/** Launches Chromium with `options`, choosing the executable as `chromeExecutable` does. */
export async function launchBrowser(options: LaunchOptions = {}) {
  const { chromium } = await import('@playwright/test')
  return chromium.launch({
    ...options,
    executablePath: chromeExecutable(chromium.executablePath()),
  })
}
