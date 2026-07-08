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
      // Ladle sets [data-storyloaded] on <html> as a cleanup effect when its
      // own lazy-loading spinner unmounts (i.e. once the story chunk's
      // dynamic import resolves) — but that fires as soon as React starts
      // committing the replacement, not once it has actually finished
      // committing + the browser has painted it. Measured directly: content
      // that is provably present half a second later reads back as a
      // completely empty `<body>` immediately after this selector resolves.
      // A blank frame is also *stable* (unchanging), so toHaveScreenshot's own
      // frame-stability retry happily locks in that blank frame as "settled"
      // — it never gets a chance to see the real content. So: don't trust the
      // attribute: wait for the story to have actually produced DOM content
      // (survives router/Suspense/lazy-import timing) and paint (fonts +
      // a couple of animation frames) before ever taking a screenshot.
      await page.waitForSelector('[data-storyloaded]', { timeout: 15_000 })
      // Fixed settle delay rather than a DOM-shape predicate: story bodies
      // range from a single <Text> node to a full nested card tree, so no
      // single "enough elements exist" threshold fits every story. 500ms was
      // confirmed (by direct before/after DOM dumps) to comfortably outlast
      // the commit+paint gap above.
      await page.waitForTimeout(500)
      await page.evaluate(() => document.fonts.ready)
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      )
      await expect(page).toHaveScreenshot(`${id}.png`, {
        fullPage: true,
        animations: 'disabled',
      })
    })
  }
})
