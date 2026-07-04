import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/**
 * Visual-regression snapshots of every Ladle story (issue #30).
 *
 * `ladle build` writes a manifest of all discovered stories to
 * build-ladle/meta.json. We read it from disk (rather than fetching it over
 * HTTP) so no extra runtime dependency is needed, and generate one snapshot
 * test per story. New stories are therefore snapshotted automatically without
 * editing this file — a maintainer just runs `test:visual:update` to add the
 * baseline.
 *
 * Baselines live in visual/__screenshots__/ and are rendered per-OS, so they
 * must be generated on the same platform CI uses (Linux). See
 * playwright.visual.config.ts and the CI `visual-regression` job.
 */
type LadleMeta = {
  stories: Record<string, { meta?: { skip?: boolean } }>
}

const here = dirname(fileURLToPath(import.meta.url))
const metaPath = resolve(here, '..', 'build-ladle', 'meta.json')

const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as LadleMeta
const storyIds = Object.keys(meta.stories).sort()

test.describe('Ladle story visual regression', () => {
  for (const id of storyIds) {
    test(id, async ({ page }) => {
      test.skip(Boolean(meta.stories[id]?.meta?.skip), 'story meta.skip is true')

      // `mode=preview` renders the isolated story with no Ladle nav chrome.
      await page.goto(`/?story=${encodeURIComponent(id)}&mode=preview`)
      // Ladle sets [data-storyloaded] once the story component has mounted.
      await page.waitForSelector('[data-storyloaded]', { timeout: 15_000 })
      await expect(page).toHaveScreenshot(`${id}.png`, {
        fullPage: true,
        animations: 'disabled',
      })
    })
  }
})
