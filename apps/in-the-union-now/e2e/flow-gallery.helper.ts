/**
 * THROWAWAY DEV SCAFFOLD — Slice G (#239).
 *
 * Flow-capture script. Walks every major ITUN flow against a running dev server
 * and writes labelled desktop + mobile PNGs to a throwaway dir
 * (apps/in-the-union-now/.tmp-shots/flow-gallery/). Extends the
 * `capture-shots.helper.ts` pattern.
 *
 * NOT in the CI test matrix: the `.helper.ts` extension does not match the
 * `*.e2e.ts` testMatch glob in playwright.config.ts.
 *
 * Seeds via the /dev route (the dev seed button) so every sheet has populated
 * data, then captures: dashboard, the three create wizards, the three seeded
 * sheets (equipment choice cards, ability AP/used, stat steppers, system cards,
 * Heat Check control + rolled result, crawler bays with NPC fields, theming),
 * and — when the snapshot backend is reachable — a published snapshot view.
 *
 * Run manually (do NOT add to CI):
 *   cd apps/in-the-union-now
 *   bunx playwright test --project=chromium --workers=1 --retries=0 e2e/flow-gallery.helper.ts
 *
 * >>> REMOVAL NOTE (delete before #239 merges): part of the throwaway scaffold;
 * >>> delete alongside scaffold/ and src/routes/dev.tsx.
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { test, expect, type Page } from '@playwright/test'
import { waitForReady } from './_helpers'
import { SEED_IDS } from '../scaffold/seedIds'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SHOTS_DIR = path.resolve(__dirname, '../.tmp-shots/flow-gallery')

const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 375, height: 812 }

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

/** Capture a desktop + mobile pair for the current page state under `name`. */
async function shotPair(page: Page, name: string) {
  ensureDir(SHOTS_DIR)
  for (const [suffix, vp] of [
    ['desktop-1440', DESKTOP],
    ['mobile-375', MOBILE],
  ] as const) {
    await page.setViewportSize(vp)
    await page.waitForTimeout(300)
    await page.screenshot({
      path: path.join(SHOTS_DIR, `${name}-${suffix}.png`),
      fullPage: true,
    })
  }
  // Reset to desktop so subsequent navigations render at the wider layout.
  await page.setViewportSize(DESKTOP)
}

/** Navigate, wait for game-data + router hydration, then capture a pair. */
async function gotoAndShot(page: Page, url: string, name: string) {
  await page.goto(url)
  await waitForReady(page)
  await page.waitForTimeout(500)
  await shotPair(page, name)
}

test('capture full ITUN flow gallery', async ({ page }) => {
  test.setTimeout(180_000)

  // -------------------------------------------------------------------------
  // 1. Seed the sample set via the dev flow index.
  // -------------------------------------------------------------------------
  await page.goto('/dev')
  await waitForReady(page)
  const seedButton = page.getByRole('button', { name: /Seed sample data/i })
  await expect(seedButton).toBeVisible({ timeout: 15_000 })
  await seedButton.click()
  await expect(page.getByTestId('seed-status')).toContainText(/Seeded/i, { timeout: 30_000 })
  await shotPair(page, '00-dev-flow-index')

  // -------------------------------------------------------------------------
  // 2. Dashboard (now populated by the seed).
  // -------------------------------------------------------------------------
  await gotoAndShot(page, '/', '01-dashboard')

  // -------------------------------------------------------------------------
  // 3. Create wizards (empty initial step is enough to show the create UI).
  // -------------------------------------------------------------------------
  await gotoAndShot(page, '/pilots/new', '02-pilot-create')
  await gotoAndShot(page, '/mechs/new', '03-mech-create')
  await gotoAndShot(page, '/crawlers/new', '04-crawler-create')

  // -------------------------------------------------------------------------
  // 4. Seeded sheets — populated, theming + interactive controls visible.
  //    Pilot: equipment choice cards, ability AP/used toggles, HP/AP steppers.
  //    Mech:  system/module cards w/ conditions, Heat Check control + result.
  //    Crawler: bays with NPC name/HP/description/facts, pink theming.
  // -------------------------------------------------------------------------
  await gotoAndShot(page, `/sheet/pilot/${SEED_IDS.pilot}`, '05-pilot-sheet')
  await gotoAndShot(page, `/sheet/mech/${SEED_IDS.mech}`, '06-mech-sheet')
  await gotoAndShot(page, `/sheet/crawler/${SEED_IDS.crawler}`, '07-crawler-sheet')

  // -------------------------------------------------------------------------
  // 5. Snapshot view — publish the seeded pilot, then capture the share view.
  //    Publishing hits a Netlify function that is NOT served by plain
  //    `vite dev`, so this is best-effort: on failure we log and skip rather
  //    than failing the whole gallery run.
  // -------------------------------------------------------------------------
  await page.setViewportSize(DESKTOP)
  await page.goto(`/sheet/pilot/${SEED_IDS.pilot}`)
  await waitForReady(page)
  const shareButton = page.getByRole('button', {
    name: /Publish snapshot and get share URL/i,
  })
  if (await shareButton.isVisible().catch(() => false)) {
    await shareButton.click()
    // ShareURLDialog renders the absolute /s/<id> URL on success.
    const shareLink = page.getByText(/\/s\//).first()
    const gotUrl = await shareLink.isVisible({ timeout: 8_000 }).catch(() => false)
    if (gotUrl) {
      const text = (await shareLink.textContent()) ?? ''
      const match = text.match(/\/s\/[A-Za-z0-9_-]+/)
      if (match) {
        await gotoAndShot(page, match[0], '08-snapshot-view')
      } else {
        // eslint-disable-next-line no-console
        console.warn('[flow-gallery] Could not parse share URL; skipping snapshot shot.')
      }
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        '[flow-gallery] Snapshot publish did not return a URL (backend not running under vite dev). Skipping snapshot shot.'
      )
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn('[flow-gallery] Share button not found; skipping snapshot shot.')
  }

  // eslint-disable-next-line no-console
  console.log(`[flow-gallery] Screenshots written to ${SHOTS_DIR}`)
})
