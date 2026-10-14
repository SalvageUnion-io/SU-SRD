import { describe, expect, spyOn, test } from 'bun:test'
import { chromeExecutable, launchBrowser } from '../lib/chromium'

/**
 * `packages/gates/lib/chromium.ts` — the one Chromium launcher the shot,
 * gallery and srd brand/og:image scripts share.
 */

/** Runs `run` with `SHOT_CHROME_PATH` set to `value` (or unset), restoring it after. */
async function withEnv<T>(value: string | undefined, run: () => Promise<T> | T): Promise<T> {
  const saved = process.env.SHOT_CHROME_PATH
  if (value === undefined) delete process.env.SHOT_CHROME_PATH
  else process.env.SHOT_CHROME_PATH = value
  try {
    return await run()
  } finally {
    if (saved === undefined) delete process.env.SHOT_CHROME_PATH
    else process.env.SHOT_CHROME_PATH = saved
  }
}

describe('chromeExecutable', () => {
  test("uses Playwright's own Chromium when it is installed", async () => {
    expect(await withEnv(undefined, () => chromeExecutable(process.execPath))).toBeUndefined()
  })

  test('SHOT_CHROME_PATH overrides every other choice', async () => {
    expect(await withEnv('/custom/chrome', () => chromeExecutable(process.execPath))).toBe(
      '/custom/chrome'
    )
  })
})

describe('launchBrowser', () => {
  /** Launches with Playwright's `launch` stubbed, returning the options it was given. */
  async function launchOptions(own: string, envPath: string | undefined, options?: object) {
    const { chromium } = await import('@playwright/test')
    const executable = spyOn(chromium, 'executablePath').mockReturnValue(own)
    const launch = spyOn(chromium, 'launch').mockImplementation(
      (async (given: unknown) => given) as unknown as typeof chromium.launch
    )
    try {
      return await withEnv(envPath, async () => (await launchBrowser(options)) as unknown)
    } finally {
      executable.mockRestore()
      launch.mockRestore()
    }
  }

  test("uses Playwright's own Chromium when it is installed", async () => {
    expect(await launchOptions(process.execPath, undefined)).toEqual({ executablePath: undefined })
  })

  test('SHOT_CHROME_PATH overrides every other choice', async () => {
    expect(await launchOptions(process.execPath, '/custom/chrome')).toEqual({
      executablePath: '/custom/chrome',
    })
  })

  test("passes the caller's launch options through", async () => {
    expect(await launchOptions(process.execPath, undefined, { args: ['--disable-gpu'] })).toEqual({
      args: ['--disable-gpu'],
      executablePath: undefined,
    })
  })
})
