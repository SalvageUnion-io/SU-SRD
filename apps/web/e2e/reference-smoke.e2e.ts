import { DESIGN_VIEWPORTS } from 'gates/lib/designViewports'
import { escapeRegExp, pageOverflow } from './_helpers'
import { expect, test } from './fixtures'

test.use({ account: 'anonymous' })

/**
 * Smoke suite — proves the static build serves, islands hydrate, and the core
 * navigation surfaces work. `chassis` / `Mule` are core, stable entities used
 * as fixtures (the same chassis the app's e2e builds against).
 */

// (a) Landing page loads and search returns results.
test('landing page loads and search returns results', { tag: '@pr' }, async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Salvage Union/i)

  // The bar's field is on every width: on a phone, a row of its own under
  // the bar.
  const nav = page

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
test('chassis schema index renders entities', { tag: '@pr' }, async ({ page }) => {
  await page.goto('/chassis/')
  await expect(page).toHaveTitle(/Chassis/i)

  // Entities render as the List's lines (one Ledger), each name a link to its
  // own item page.
  await expect(
    page.locator('.su-ledger__name a[href^="/chassis/"]:not([href="/chassis/"])').first()
  ).toBeVisible({
    timeout: 30_000,
  })
})

// (c) An individual entity page renders.
test('a chassis entity page renders its card', { tag: '@pr' }, async ({ page }) => {
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

// (d) The home page is the site's front door, then the manual's Contents.
test('the home page opens three ways in and indexes the book’s chapters', { tag: '@pr' }, async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'SalvageUnion.io' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Three ways in' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Contents' })).toBeVisible()
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
        name: new RegExp(`^${escapeRegExp(chapter)}`),
      })
    ).toBeVisible()
  }
  expect((await pageOverflow(page)).across).toBeLessThanOrEqual(0)
})

// (e) A chassis page at a phone's width and a desktop's: its stat column
// leads the body, clear of the title (the phone bug was a stat strip over
// it), beside the side column's art from `lg`, and nothing scrolls sideways.
for (const width of [375, 1440]) {
  test(`an entity page at ${width}px keeps its stats clear of its title`, { tag: '@pr' }, async ({
    page,
  }) => {
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
    expect((await pageOverflow(page)).across).toBeLessThanOrEqual(0)
    if (width === 1440) {
      // The stats at the left, the line-art hero in the side column at the right.
      const art = await page.locator('.su-manual__art').first().boundingBox()
      expect(art).toBeTruthy()
      if (art && statsBox) expect(statsBox.x).toBeLessThan(art.x)
    }
  })
}

// A listing line names its entity: the name never loses a character to the cells.
for (const width of [375, 1440]) {
  test(`a chassis listing line at ${width}px shows its name in full`, { tag: '@pr' }, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/chassis/')
    const name = page.locator('.su-ledger__name', {
      has: page.getByRole('link', { name: 'Scrapper', exact: true }),
    })
    await expect(name).toBeVisible({ timeout: 30_000 })
    const fits = await name.evaluate((el) => el.scrollWidth <= el.clientWidth)
    expect(fits).toBe(true)
    expect((await pageOverflow(page)).across).toBeLessThanOrEqual(0)
  })
}

// The long names (Electro-Magnetic Shield Projector, System and Software
// Hacker): every compact card holds its parts — the name ends in "…" inside it, and
// its chips and cells stay inside instead of being pushed past its edge. A
// systems CompactIndex's frame; an ability Compact's head, on the Tree.
for (const [schema, view, part] of [
  ['systems', 'catalog', '.su-listing__tiles a[aria-label] .su-entity-index__frame'],
  ['abilities', 'tree', '.su-listing a[aria-label] [data-fill]'],
] as const) {
  test(`every ${schema} listing card at 375px keeps its parts inside it`, { tag: '@pr' }, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto(`/${schema}/?view=${view}`)
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
          // An empty overflow row is hidden: no box, so nothing to hold in.
          if (edge.width === 0 && edge.height === 0) continue
          if (edge.left < box.left || edge.right > box.right + 0.5) problems.push('part outside')
        }
        return problems.length ? [`${name}: ${problems.join(', ')}`] : []
      })
    )
    expect(broken).toEqual([])
  })
}

// (f) A roll table rolling on its own page: `roll-instrument.e2e.ts`.

// (g) Every listing's Catalog at every width: one flat grid of CompactIndexes, no
// group headings, its List one press away (E2), each art box one height (24rem) whatever
// its tile's width before its image loads (on a phone, at 40rem and below, a 2:1 band).
for (const width of [1440, 390]) {
  test(`the /chassis/ Catalog is one flat grid at ${width}px`, { tag: '@pr' }, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/chassis/?view=catalog')
    const tile = page.locator('.su-listing__tiles a.su-entity-index').first()
    await expect(tile).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.su-listing__group')).toHaveCount(1)
    await expect(page.locator('.su-listing__group[aria-label]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'List' }).first()).toBeVisible()
    // boundingBox() does not wait, so wait for the art box to lay out first.
    const art = tile.locator('.su-entity-index__art')
    await expect(art).toBeVisible()
    const box = await art.boundingBox()
    expect(box).not.toBeNull()
    if (box && width > 640) expect(box.height).toBeCloseTo(384, 0)
    else if (box) expect(Math.abs(box.width / box.height - 2 / 1)).toBeLessThan(0.02)
  })
}

// (h) The abilities open on their List, as every listing does, and offer
// their Tree (each tree on its track) and a flat Catalog under no tree heading.
test('the abilities open on their List and offer a Tree and a flat Catalog', {
  tag: '@pr',
}, async ({ page }) => {
  await page.setViewportSize(DESIGN_VIEWPORTS.page)
  await page.goto('/abilities/')
  const list = page.getByRole('button', { name: 'List' })
  await expect(list).toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 })
  await expect(page.locator('.su-listing .su-ledger__table')).toHaveCount(1)
  // Exact: the List's head stamps sort, and one sorts by Tree.
  await page.getByRole('button', { name: 'Tree', exact: true }).click()
  await expect(page.locator('.su-ability-track').first()).toBeVisible()
  await page.getByRole('button', { name: 'Catalog' }).click()
  await expect(page.locator('.su-ability-track')).toHaveCount(0)
  await expect(page.locator('.su-listing__group')).toHaveCount(1)
  await expect(page.locator('.su-listing__tiles a.su-entity-index').first()).toBeVisible()
  await expect(page).toHaveURL(/view=catalog/)
})
