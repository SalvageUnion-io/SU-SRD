#!/usr/bin/env bun
/** MOCK: wave-2 probe. Taps and holds the phone vitals, shoots the state, puts the numbers back. */
import { FORCE_ONLINE, launchBrowser } from 'gates/lib/chromium'
import { DESIGN_VIEWPORTS } from 'gates/lib/designViewports'
import { signInThroughSeam } from 'gates/lib/testSignIn'
import { portFor } from 'gates/ports'
import { APP_BASE } from '../apps/web/src/lib/appBase'
import { readSeedFile } from './shot'

const out = process.argv[2] ?? '.shots'
const seed = readSeedFile()
const base = `http://localhost:${portFor()}`
const browser = await launchBrowser()
try {
  const page = await browser.newPage({ viewport: DESIGN_VIEWPORTS.phone, hasTouch: true })
  await page.addInitScript(FORCE_ONLINE)
  await page.goto(`${base}${APP_BASE}/`, { waitUntil: 'networkidle', timeout: 60_000 })
  await signInThroughSeam(page, seed, { flow: 'signIn' })
  await page.goto(`${base}${seed.mech}`, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForTimeout(1500)
  const settle0 = async () => {
    for (const [key, want] of [['heat', 0], ['ep', 10]] as const) {
      for (let i = 0; i < 30; i++) {
        const now = Number(await value(key))
        if (now === want) break
        const name = key === 'heat' ? 'Heat Capacity' : 'Energy Points'
        await page.getByRole('button', { name: `${now < want ? 'Increase' : 'Decrease'} ${name}` }).click()
        await page.waitForTimeout(250)
      }
    }
    await page.waitForTimeout(6000)
  }
  const value = (key: string) =>
    page.locator(`[data-vital="${key}"] .su-phone-vitals__value b`).innerText()
  const plusHeat = page.getByRole('button', { name: 'Increase Heat Capacity' })
  const minusHeat = page.getByRole('button', { name: 'Decrease Heat Capacity' })
  const minusEp = page.getByRole('button', { name: 'Decrease Energy Points' })
  const plusEp = page.getByRole('button', { name: 'Increase Energy Points' })
  await settle0()
  console.log('targets', JSON.stringify(await plusHeat.boundingBox()), JSON.stringify(await page.locator('[data-vital="heat"] [role=slider]').boundingBox()))
  for (let i = 0; i < 5; i++) await plusHeat.click()
  await page.waitForTimeout(600)
  console.log('heat after 5 taps', await value('heat'))
  // A hold: press and keep for 900ms.
  const box = await minusEp.boundingBox()
  if (!box) throw new Error('no EP stepper')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(900)
  await page.mouse.up()
  await page.waitForTimeout(600)
  console.log('ep after a 900ms hold', await value('ep'))
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/after-mech-phone-fold-live.png` })
  // Put the numbers back: Heat 0, EP 10.
  const settle = async (key: string, want: number, up: typeof plusEp, down: typeof plusEp) => {
    for (let i = 0; i < 30; i++) {
      const now = Number(await value(key))
      if (now === want) return
      await (now < want ? up : down).click()
      await page.waitForTimeout(250)
    }
  }
  await settle('heat', 0, plusHeat, minusHeat)
  await settle('ep', 10, plusEp, minusEp)
  console.log('restored', await value('heat'), await value('ep'))
  await page.waitForTimeout(800)
} finally {
  await browser.close()
}
