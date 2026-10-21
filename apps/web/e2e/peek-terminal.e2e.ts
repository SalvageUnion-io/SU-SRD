import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { at } from './_base'

/**
 * Hard rule R33, "A Peek is terminal" (ruleset §1.6; EDL E16), on the rendered
 * page: open a Peek of every kind that has one and read its plate
 * (`[data-peek-popup]`). A finding's rule is one of:
 *
 * - `control`: a button, a link (`a[href]`), a field (`input`, `select`,
 *   `textarea`), a `role="button"` or `role="link"`, or anything else in the
 *   tab order: nothing on a Peek acts, but its name.
 * - `open`: the one exception (R33), the
 *   card's name as the link to its Page (`[data-peek-open]`, `CardTitleLink`):
 *   at most one, in the plate's first head's title, out of the tab order.
 * - `nested`: a Peek trigger (`[data-peek]`): a Peek never opens a Peek.
 * - `inert`: a chip (a trait or relation Tag, an action's chip, a Mini's
 *   head) that still draws the pointer: on the plate it reads, and only reads.
 *
 * A kind is a Peek address's schema, with its part where it has one
 * (`crawler-bays/npc`, a bay's crew NPC; `systems/table`, a record's roll
 * table). They are found where a reader finds them: the Union bar's search
 * (every entity schema it Peeks) and the Mentions, Tags and roll Minis on the
 * SRD's pages. `KINDS` is every kind found when this gate landed; a kind that
 * stops Peeking fails it, so a new kind is added here when it starts to.
 */

/** A schema and a name the Union bar's search finds a Peek-able Mini for. */
const SEARCH: readonly { schema: string; name: string }[] = [
  { schema: 'abilities', name: 'Engineering Expertise' },
  { schema: 'bio-titans', name: 'Typhon' },
  { schema: 'chassis', name: 'Big Brother' },
  { schema: 'classes', name: 'Hacker' },
  { schema: 'crawler-bays', name: 'Armoury' },
  { schema: 'crawler-tech-levels', name: 'Hamlet Crawler' },
  { schema: 'crawlers', name: 'Battle' },
  { schema: 'creatures', name: 'Chimeripede' },
  { schema: 'drones', name: 'Pest Drone' },
  { schema: 'equipment', name: 'Portable Arc Welder' },
  { schema: 'factions', name: 'Wagon Wasters' },
  { schema: 'keywords', name: 'action scene' },
  { schema: 'meld', name: 'Meld Nanoid' },
  { schema: 'modules', name: 'Survey Scanner' },
  { schema: 'npcs', name: 'Saboteur' },
  { schema: 'roll-tables', name: 'Core Mechanic' },
  { schema: 'squads', name: 'Rifle Squad' },
  { schema: 'systems', name: 'Salvaging Drill' },
  { schema: 'traits', name: 'amphibious' },
  { schema: 'vehicles', name: 'Power Loader' },
]

/** SRD pages whose Mentions, Tags and roll Minis Peek. */
const PAGES = [
  '/chassis/mazona/',
  '/chassis/mazona/pattern/buzzard/',
  '/chassis/big-brother/',
  '/systems/salvaging-drill/',
  '/systems/mechapult/',
  '/classes/hacker/',
  '/abilities/',
  '/bio-titans/tyrant/',
  '/npcs/saboteur/',
  '/drones/pest-drone/',
  '/crawler-bays/armoury/',
  '/crawler-bays/command-bay/',
  '/vehicles/fighting-box-wheel/',
  '/roll-tables/core-mechanic/',
  '/keywords/',
  // A Starter Set sheet: a crawler bay's roll Mini, folded off its own page,
  // and its actions' Mentions.
  at('/starter/crawler/starter-crawler-tenacity'),
]

/** Every kind that Peeks, found when this gate landed. */
const KINDS: readonly string[] = [
  'abilities',
  'actions',
  'bio-titans',
  'chassis',
  'classes',
  'crawler-bays',
  'crawler-bays/npc',
  'crawler-bays/table',
  'crawler-tech-levels',
  'crawlers',
  'creatures',
  'drones',
  'equipment',
  'factions',
  'keywords',
  'meld',
  'modules',
  'npcs',
  'roll-tables',
  'squads',
  'systems',
  'traits',
  'vehicles',
]

/** A Peek address's kind: its schema, and its part (`npc`, `table`) where it has one. */
function kindOf(address: string): string {
  const [schema, id = ''] = address.split(':')
  const part = id.split('/')[1]
  return part ? `${schema}/${part}` : (schema ?? address)
}

/** Runs in the page: every fault on the open plate, one line each. */
function scanPlate(): string[] {
  const plate = document.querySelector('[data-peek-popup]')
  if (!plate) return ['plate: no Peek is open']
  const what = (el: Element) => {
    const name = el.getAttribute('aria-label') ?? (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    const cls = el.classList[0] ? `.${el.classList[0]}` : ''
    return `${el.tagName.toLowerCase()}${cls} "${name.slice(0, 40)}"`
  }
  const out: string[] = []
  const controls = [
    'button',
    'a[href]',
    'input',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',')
  for (const el of plate.querySelectorAll(controls)) {
    if (!el.hasAttribute('data-peek-open')) out.push(`control: ${what(el)}`)
  }
  const opens = [...plate.querySelectorAll('[data-peek-open]')]
  if (opens.length > 1) out.push(`open: ${opens.length} linked names, not one`)
  const title = plate.querySelector('.su-entity-compact__head .su-entity-compact__title')
  for (const el of opens) {
    if (!title?.contains(el)) out.push(`open: ${what(el)} is not the card's name`)
    if (el.getAttribute('tabindex') !== '-1') out.push(`open: ${what(el)} is in the tab order`)
  }
  for (const el of plate.querySelectorAll('[data-peek]')) {
    out.push(`nested: ${what(el)} Peeks ${el.getAttribute('data-peek')}`)
  }
  const chips = '[data-tag], [data-chip-group] > *, .su-entity-mini, .su-entity-compact__head'
  for (const el of plate.querySelectorAll(chips)) {
    if (getComputedStyle(el).cursor === 'pointer') out.push(`inert: ${what(el)} draws the pointer`)
  }
  return [...new Set(out)]
}

/** Open the Peek `trigger` names, read its plate, close it. */
async function peekAt(page: Page, trigger: Locator, where: string): Promise<string[]> {
  await trigger.scrollIntoViewIfNeeded()
  await trigger.hover()
  const popup = page.locator('[data-peek-popup]')
  await expect(
    popup.locator('.su-entity-compact__head, .su-roll').first(),
    `${where}: the Peek draws its card`
  ).toBeVisible()
  const faults = (await page.evaluate(scanPlate)).map((f) => `${where}: ${f}`)
  await page.mouse.move(0, 0)
  await page.keyboard.press('Escape')
  await expect(popup).toHaveCount(0)
  return faults
}

test.describe.configure({ retries: 0 })
test.use({ viewport: { width: 1440, height: 900 } })

test('a Peek of every kind is terminal', async ({ page }) => {
  test.setTimeout(10 * 60_000)
  const opened = new Map<string, string>()
  const failures: string[] = []

  // The Union bar's search: a Mini per schema.
  for (const { schema, name } of SEARCH) {
    await page.goto('/chassis/', { waitUntil: 'networkidle' })
    const search = page.getByRole('combobox', { name: 'Search the Reference' }).first()
    await search.click()
    await search.fill(name)
    const trigger = page
      .locator(`[role="option"][data-peek^="${schema}:"]`)
      .filter({ hasText: name })
      .first()
    const found = await trigger.waitFor({ state: 'visible', timeout: 10_000 }).then(
      () => true,
      () => false
    )
    if (!found) continue
    const address = (await trigger.getAttribute('data-peek')) ?? schema
    const kind = kindOf(address)
    if (opened.has(kind)) continue
    opened.set(kind, `the ${name} Peek from the search`)
    failures.push(...(await peekAt(page, trigger, `the ${name} Peek (${kind})`)))
  }

  // The SRD's pages: each kind their Mentions, Tags and roll Minis open.
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: 'networkidle' })
    const addresses = await page.evaluate(() =>
      [...document.querySelectorAll('[data-peek]')]
        .filter((el) => !el.closest('[data-peek-popup], [role="listbox"]'))
        .filter((el) => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0
        })
        .map((el) => el.getAttribute('data-peek') ?? '')
    )
    for (const address of addresses) {
      const kind = kindOf(address)
      if (opened.has(kind)) continue
      opened.set(kind, `${address} on ${path}`)
      const trigger = page.locator(`[data-peek="${address}"]`).filter({ visible: true }).first()
      failures.push(...(await peekAt(page, trigger, `${path}, the ${address} Peek (${kind})`)))
    }
  }

  test.info().annotations.push({ type: 'kinds', description: [...opened.keys()].sort().join(' ') })
  expect([...opened.keys()].sort(), 'every kind that Peeks opened one').toEqual(
    expect.arrayContaining([...KINDS])
  )
  expect(failures, 'a Peek is terminal: nothing on its plate acts').toEqual([])
})
