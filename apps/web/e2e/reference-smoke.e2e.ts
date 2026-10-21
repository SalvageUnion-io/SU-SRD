import { expect, test } from '@playwright/test'

/**
 * Smoke suite — proves the static build serves, islands hydrate, and the core
 * navigation surfaces work. `chassis` / `Mule` are core, stable entities used
 * as fixtures (the same chassis the app's e2e builds against).
 */

// (a) Landing page loads and search returns results.
test('landing page loads and search returns results', async ({ page, isMobile }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Salvage Union/i)

  // On a phone the nav bar holds a magnifier instead of the field; it opens a
  // sheet hosting the same combobox.
  if (isMobile) await page.getByRole('button', { name: /search the reference/i }).click()
  const nav = isMobile ? page.getByRole('dialog') : page

  // The field is served as plain HTML (the home page's is a GET form) and
  // becomes the combobox when a reader reaches for it; what they type before
  // it mounts is carried over. It loads the search index on first intent,
  // then renders result options.
  const name = /search the reference/i
  const search = nav
    .getByRole('combobox', { name })
    .or(nav.getByRole('searchbox', { name }))
    .first()
  await search.click()
  await search.fill('Mule')

  const listbox = page.getByRole('listbox')
  await expect(listbox.getByRole('option').first()).toBeVisible({ timeout: 30_000 })
  await expect(listbox).toContainText(/Mule/i)
})

// (b) A schema index page renders its entities.
test('chassis schema index renders entities', async ({ page }) => {
  await page.goto('/chassis/')
  await expect(page).toHaveTitle(/Chassis/i)

  // Entities render (after the island hydrates + game data loads) as links to
  // their individual item pages.
  await expect(
    page.locator('a[aria-label][href^="/chassis/"]:not([href="/chassis/"])').first()
  ).toBeVisible({
    timeout: 30_000,
  })
})

// (c) An individual entity page renders.
test('a chassis entity page renders its card', async ({ page }) => {
  await page.goto('/chassis/mule/')
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

// (d) The home page is the manual's Contents page.
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
  await expect(page.getByRole('heading', { name: 'Start here' })).toBeVisible()
})

// (e) A chassis page at a phone's width and a desktop's: its
// stats lead the body, inline, clear of the title (the phone bug was a stat
// strip over it), beside the art from `sm`, and nothing scrolls sideways.
for (const width of [375, 1440]) {
  test(`an entity page at ${width}px keeps its stats clear of its title`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/chassis/gopher/')
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
      // The line-art hero on the left, the stats on the right.
      const art = await page.locator('.su-entity-page__art').first().boundingBox()
      expect(art).toBeTruthy()
      if (art && statsBox) expect(art.x).toBeLessThan(statsBox.x)
    }
  })
}

// A listing tile names its entity: the name never loses a character to the cells.
for (const width of [375, 1440]) {
  test(`a chassis listing tile at ${width}px shows its name in full`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/chassis/')
    const row = page.locator('a[aria-label="Scrapper"][href*="/chassis/"]')
    await expect(row).toBeVisible({ timeout: 30_000 })
    const name = row.getByText('Scrapper', { exact: true })
    const fits = await name.evaluate((el) => el.scrollWidth <= el.clientWidth)
    expect(fits).toBe(true)
  })
}

// The long names (Electro-Magnetic Shield Projector, System and Software
// Hacker): every compact card holds its parts — the name ends in "…" inside it, and
// its chips and cells stay inside instead of being pushed past its edge. A
// systems CompactIndex's frame; an ability Compact's head, on the Tree.
for (const [schema, part] of [
  ['systems', '.su-listing__tiles a[aria-label] .su-entity-index__frame'],
  ['abilities', '.su-listing__cards a[aria-label] [data-fill]'],
] as const) {
  test(`every ${schema} listing card at 375px keeps its parts inside it`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto(`/${schema}/`)
    const headers = page.locator(part)
    await expect(headers.first()).toBeVisible({ timeout: 30_000 })
    const broken = await headers.evaluateAll((rows) =>
      rows.flatMap((header) => {
        const name = header.closest('a')?.getAttribute('aria-label') ?? '?'
        const box = header.getBoundingClientRect()
        const problems: string[] = []
        if (header.scrollWidth > header.clientWidth) problems.push('scrolls')
        for (const part of header.children) {
          const edge = part.getBoundingClientRect()
          if (edge.left < box.left || edge.right > box.right + 0.5) problems.push('part outside')
        }
        return problems.length ? [`${name}: ${problems.join(', ')}`] : []
      })
    )
    expect(broken).toEqual([])
  })
}

// (f) A roll table rolls on its own page.
test('a roll table page rolls and marks the result', async ({ page }) => {
  await page.goto('/roll-tables/core-mechanic/')
  // The ROLL THE DIE stamp is the roll: a button once the island mounts (the
  // server markup's stamp is a plain label), and the page's only one.
  const roll = page.getByRole('button', { name: 'Roll the die on Core Mechanic' })
  await expect(roll).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('main').getByRole('button', { name: /^Roll/ })).toHaveCount(1)
  await roll.click()
  await expect(page.getByText(/^Rolled \d+$/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Randsum.dev' })).toBeVisible()
})

// (g) Every listing is the Catalog at every width: one flat grid of CompactIndexes, no
// group headings and no view toggle, each art box 3:4 before its image loads
// (on a phone, at 40rem and below, a 2:1 band).
for (const width of [1440, 390]) {
  test(`the /chassis/ Catalog is one flat grid at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/chassis/')
    const tile = page.locator('.su-listing__tiles a.su-entity-index').first()
    await expect(tile).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.su-listing__group')).toHaveCount(1)
    await expect(page.locator('.su-listing__group[aria-label]')).toHaveCount(0)
    await expect(page.locator('.su-rail__view')).toHaveCount(0)
    // boundingBox() does not wait, so wait for the art box to lay out first.
    const art = tile.locator('.su-entity-index__art')
    await expect(art).toBeVisible()
    const box = await art.boundingBox()
    expect(box).not.toBeNull()
    const ratio = width > 640 ? 3 / 4 : 2 / 1
    if (box) expect(Math.abs(box.width / box.height - ratio)).toBeLessThan(0.02)
  })
}

// (h) The abilities open on their Tree (each tree on its track), one column;
// their Catalog is one flat grid of CompactIndexes, under no tree heading.
test('the abilities open on their Tree and offer a flat Catalog', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/abilities/')
  const tree = page.getByRole('button', { name: 'Tree' })
  await expect(tree).toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 })
  await expect(page.locator('.su-ability-track').first()).toBeVisible()
  await page.getByRole('button', { name: 'Catalog' }).click()
  await expect(page.locator('.su-ability-track')).toHaveCount(0)
  await expect(page.locator('.su-listing__group')).toHaveCount(1)
  await expect(page.locator('.su-listing__tiles a.su-entity-index').first()).toBeVisible()
  await expect(page).toHaveURL(/view=catalog/)
})
