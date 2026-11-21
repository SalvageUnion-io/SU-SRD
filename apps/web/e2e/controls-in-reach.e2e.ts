import type { Page } from '@playwright/test'
import { DESIGN_VIEWPORTS } from 'gates/lib/designViewports'
import { findControlsOutOfReach } from './_controlsInReach'
import { place } from './_findings'
import type { WizardKind } from './_helpers'
import { runWizard } from './_helpers'
import { expect, test } from './fixtures'

/**
 * K14, every control in reach (`_controlsInReach.ts`), on every step of the
 * three wizards at a phone, a laptop and the page width: each control inside
 * its frame, and a press at its centre landing on it. On the mech's Systems
 * step a copy is added first, so a picked row's stepper is read too.
 */

const WIDTHS = [
  DESIGN_VIEWPORTS.phone,
  { width: 1280, height: 900 },
  DESIGN_VIEWPORTS.page,
] as const

const WALKS: Record<WizardKind, { identity: Record<string, string>; prefer: string[] }> = {
  pilots: { identity: { name: 'Reach', callsign: 'Reach' }, prefer: ['Engineer'] },
  mechs: { identity: { 'name / pattern': 'Reach' }, prefer: ['Mule'] },
  crawlers: { identity: { 'crawler name': 'Reach Wagon' }, prefer: ['Battle'] },
}

test.describe.configure({ retries: 0 })

/** Walk `kind`'s wizard to Review, every step read as it lands and once picked. */
async function walk(page: Page, kind: WizardKind): Promise<string[]> {
  const failures: string[] = []
  await runWizard(page, kind, {
    ...WALKS[kind],
    onStep: async (title, state) => {
      const add = page.getByRole('button', { name: /^Increase Armour Plating count$/ }).first()
      // Only where it stands: `isEnabled` on a missing locator waits for it.
      if (state === 'landed' && (await add.count()) > 0 && (await add.isEnabled()))
        await add.click()
      const where = `/${kind}/new, ${title}${state === 'picked' ? ', picked' : ''}`
      failures.push(...place(where, await findControlsOutOfReach(page)).map((f) => f.line))
    },
  })
  return failures
}

for (const viewport of WIDTHS) {
  test.describe(`at ${viewport.width}px`, { tag: '@pr' }, () => {
    test.use({ viewport })

    for (const kind of Object.keys(WALKS) as WizardKind[]) {
      test(`every control of the ${kind} wizard is in reach`, async ({ page }) => {
        test.setTimeout(5 * 60_000)
        expect(await walk(page, kind), 'controls past their frame or under another').toEqual([])
      })
    }
  })
}
