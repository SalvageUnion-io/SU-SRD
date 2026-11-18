#!/usr/bin/env bun
/**
 * MOCK: wave-2 board shots. One browser, many shots:
 *   bun tools/mock-shot.ts <outDir> <name>=<:key>@<phone|page>[!fold][#Tab name] …
 * `!fold` is the viewport only (390x844 / 1440x900); `#Tab` clicks that tab first.
 * Prints each file and the page's horizontal overflow in px.
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { FORCE_ONLINE, launchBrowser } from 'gates/lib/chromium'
import { DESIGN_VIEWPORTS } from 'gates/lib/designViewports'
import { signInThroughSeam } from 'gates/lib/testSignIn'
import { portFor } from 'gates/ports'
import { APP_BASE } from '../apps/web/src/lib/appBase'
import { readSeedFile } from './shot'

const [out, ...specs] = process.argv.slice(2)
if (!out || specs.length === 0)
  throw new Error('usage: mock-shot <outDir> name=:key@width[!fold][#Tab] …')
const seed = readSeedFile()
const port = portFor()
mkdirSync(out, { recursive: true })
const browser = await launchBrowser()
try {
  for (const width of ['phone', 'page'] as const) {
    const mine = specs.filter((s) => s.includes(`@${width}`))
    if (mine.length === 0) continue
    const page = await browser.newPage({ viewport: DESIGN_VIEWPORTS[width] })
    await page.addInitScript(FORCE_ONLINE)
    await page.goto(`http://localhost:${port}${APP_BASE}/`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    })
    await signInThroughSeam(page, seed, { flow: 'signIn' })
    for (const spec of mine) {
      const m = /^([^=]+)=:?([A-Za-z]+)@(phone|page)(!fold)?(?:#(.+))?$/.exec(spec)
      if (!m) throw new Error(`bad spec ${spec}`)
      const [, name, key, , fold, tab] = m
      const path = (seed as Record<string, string | undefined>)[key ?? '']
      if (!path) throw new Error(`no seed ${key}`)
      await page.goto(`http://localhost:${port}${path}`, {
        waitUntil: 'networkidle',
        timeout: 60_000,
      })
      await page.waitForTimeout(1500)
      await page.evaluate('document.fonts.ready')
      if (tab) {
        await page
          .getByRole('tab', { name: new RegExp(`^${tab}`, 'i') })
          .first()
          .click()
        await page.waitForTimeout(400)
      }
      if (!fold) {
        await page.evaluate(`(async () => {
          const step = Math.max(200, Math.floor(window.innerHeight * 0.8))
          for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
            window.scrollTo(0, y)
            await new Promise((r) => setTimeout(r, 100))
          }
          window.scrollTo(0, 0)
        })()`)
        await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined)
      }
      await page.waitForTimeout(300)
      const overflow = await page.evaluate(
        'document.documentElement.scrollWidth - document.documentElement.clientWidth'
      )
      const info = await page.evaluate(`(() => {
        const t = document.querySelector('[role=tablist]')
        const r = t && t.getBoundingClientRect()
        return { tabsTop: r ? Math.round(r.top) : null, tabsBottom: r ? Math.round(r.bottom) : null, height: document.documentElement.scrollHeight }
      })()`)
      const file = join(out, `${name}.png`)
      await page.screenshot({ path: file, fullPage: !fold })
      console.log(file, `overflow=${overflow}`, JSON.stringify(info))
    }
    await page.close()
  }
} finally {
  await browser.close()
}
