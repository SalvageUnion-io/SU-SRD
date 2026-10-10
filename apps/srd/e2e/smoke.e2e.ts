import { expect, test } from '@playwright/test'

/**
 * Smoke suite — proves the static build serves, islands hydrate, and the core
 * navigation surfaces work. `chassis` / `Mule` are core, stable entities used
 * as fixtures (the same chassis ITUN's e2e builds against).
 */

// (a) Landing page loads and search returns results.
test('landing page loads and search returns results', async ({ page, isMobile }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Salvage Union/i)

  // On a phone the nav bar holds a magnifier instead of the field; it opens a
  // sheet hosting the same combobox.
  if (isMobile) await page.getByRole('button', { name: /search the srd/i }).click()
  const nav = isMobile ? page.getByRole('dialog') : page

  // The combobox lives in the top nav; it lazily loads game data on first
  // intent (focus/type), then renders result options.
  const search = nav.getByRole('combobox', { name: /search the srd/i }).first()
  await search.click()
  await search.fill('Mule')

  const listbox = page.getByRole('listbox')
  await expect(listbox.getByRole('option').first()).toBeVisible({ timeout: 30_000 })
  await expect(listbox).toContainText(/Mule/i)
})

// (b) A schema index page renders its entities.
test('chassis schema index renders entities', async ({ page }) => {
  await page.goto('/schema/chassis/')
  await expect(page).toHaveTitle(/Chassis/i)

  // Entities render (after the island hydrates + game data loads) as links to
  // their individual item pages.
  await expect(page.locator('a[aria-label][href*="/schema/chassis/item/"]').first()).toBeVisible({
    timeout: 30_000,
  })
})

// (c) An individual entity page renders.
test('a chassis entity page renders its card', async ({ page }) => {
  await page.goto('/schema/chassis/item/mule/')
  // Title is server-rendered, so this asserts the static page exists.
  await expect(page).toHaveTitle(/Mule/i)
  // The entity name renders on the page (breadcrumb + card header). Assert the
  // text rather than a heading role: the card header hydrates from a semantic
  // heading into a styled pseudo-header, so role=heading is not reliable.
  // `visible`: the trail is drawn twice — in the Union bar on desktop, on its
  // own row on a phone — and the first copy in the DOM is hidden on a phone.
  await expect(page.getByText(/Mule/i).filter({ visible: true }).first()).toBeVisible({
    timeout: 30_000,
  })
})

// (d) The home page is the manual's Contents page (board 06).
test('the home page indexes the book’s chapters', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'The Salvage Union SRD' })).toBeVisible()
  for (const chapter of [
    'Pilot Bay',
    'Mech Workshop',
    'Union Crawler',
    'Denizens of the Wasteland',
    'Rules & Reference',
  ]) {
    // The heading reads "<chapter> <count>".
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: new RegExp(`^${chapter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      })
    ).toBeVisible()
  }
  await expect(page.getByRole('heading', { name: 'New to the Union?' })).toBeVisible()
})

// (e) An entity page at a phone's width and a desktop's (boards 07, 08): the
// stat column sits clear of the title — the phone bug where the stat strip
// covered it — and nothing scrolls sideways.
for (const width of [375, 1440]) {
  test(`an entity page at ${width}px keeps its stats clear of its title`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/schema/chassis/item/gopher/')
    const title = page.getByRole('heading', { level: 1, name: 'Gopher' })
    const stats = page.getByLabel('Gopher stats')
    await expect(title).toBeVisible()
    await expect(stats).toBeVisible({ timeout: 30_000 })
    const titleBox = await title.boundingBox()
    const statsBox = await stats.boundingBox()
    expect(titleBox && statsBox).toBeTruthy()
    if (titleBox && statsBox) {
      expect(statsBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height)
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
    if (width === 1440) {
      // Board 07: the line-art hero on the left, the stat column on the right.
      const art = await page.locator('.su-entity-page__art').first().boundingBox()
      expect(art).toBeTruthy()
      if (art && statsBox) expect(art.x).toBeLessThan(statsBox.x)
    }
  })
}

// A listing row is an index line: the name never loses a character to the cells.
for (const width of [375, 1440]) {
  test(`a chassis listing row at ${width}px shows its name in full`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/schema/chassis/')
    const row = page.locator('a[aria-label="Scrapper"][href*="/schema/chassis/item/"]')
    await expect(row).toBeVisible({ timeout: 30_000 })
    const name = row.getByText('Scrapper', { exact: true })
    const fits = await name.evaluate((el) => el.scrollWidth <= el.clientWidth)
    expect(fits).toBe(true)
  })
}

// The long names (Electro-Magnetic Shield Projector, System and Software
// Hacker): every head row holds its line — the cells drop out whole, and the
// chevron stays inside the row instead of being pushed past its edge.
for (const schema of ['systems', 'abilities']) {
  test(`every ${schema} listing row at 375px keeps its parts inside the row`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto(`/schema/${schema}/`)
    const headers = page.locator('.srd-listing__rows a[aria-label] [data-fill]')
    await expect(headers.first()).toBeVisible({ timeout: 30_000 })
    const broken = await headers.evaluateAll((rows) =>
      rows.flatMap((header) => {
        const name = header.closest('a')?.getAttribute('aria-label') ?? '?'
        const box = header.getBoundingClientRect()
        const chevron = header.querySelector('svg.lucide-chevron-right')?.getBoundingClientRect()
        const problems: string[] = []
        if (header.scrollWidth > header.clientWidth) problems.push('scrolls')
        if (!chevron) problems.push('no chevron')
        else if (chevron.left < box.left || chevron.right > box.right + 0.5)
          problems.push('chevron outside')
        return problems.length ? [`${name}: ${problems.join(', ')}`] : []
      })
    )
    expect(broken).toEqual([])
  })
}

// (f) A roll table rolls on its own page (board 08b).
test('a roll table page rolls and marks the result', async ({ page }) => {
  await page.goto('/schema/roll-tables/item/core-mechanic/')
  const roll = page.getByRole('button', { name: 'Roll the die' })
  // The island mounts the live controls; the server markup's are inert.
  await expect(roll).toBeEnabled({ timeout: 30_000 })
  await roll.click()
  await expect(page.getByText(/^Rolled \d+$/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Roll again' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Randsum.dev' })).toBeVisible()
})
