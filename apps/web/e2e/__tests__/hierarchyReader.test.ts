/**
 * The hierarchy reader (`_hierarchy.ts`, ruleset §4.8) on hand-made pages: a
 * page on the type ladder, its titles on their rungs and its headings in
 * order reads clean; each fault it names is drawn once, alone, and read back.
 */
import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import type { DesignContext } from '../_designTable'
import { findHierarchy, readActs } from '../_hierarchy'
import { documentPage } from './_page'

/** The tokens the reader probes, and every element drawn (happy-dom has no opacity default). */
const SHEET = `<style>
  :root {
    --color-rust: rgb(200, 60, 20);
    --color-ink: rgb(20, 20, 20);
    --color-paper: rgb(250, 245, 235);
    --color-band-cream: rgb(240, 230, 210);
    --color-wk-bg: rgb(230, 225, 215);
    --color-ink-deep: rgb(5, 5, 5);
    --page-measure: 40;
  }
  * { opacity: 1; font-size: 14px; }
</style>`

const { page, restore } = documentPage()
afterAll(() => {
  document.head.innerHTML = ''
  restore()
})
afterEach(() => {
  document.body.innerHTML = ''
})

/** The faults on `body` as drawn, read in `context` at a desktop width unless `phone`. */
async function faults(
  body: string,
  { phone = false, context = 'sheet' as DesignContext } = {}
): Promise<string[]> {
  document.head.innerHTML = SHEET
  document.body.innerHTML = body
  return (await findHierarchy(page, { context, phone })).map((f) => f.detail)
}

describe('the type ladder and the titles (§4.8, E24)', () => {
  test('text on a rung passes; a size off the ladder is named', async () => {
    expect(await faults('<p>Fine</p>')).toEqual([])
    const found = await faults('<p style="font-size: 15px">Odd size</p>')
    expect(found).toEqual(['type-ladder: 15px p "Odd size"'])
  })

  test('a text in a link preview card draws at its own size', async () => {
    expect(await faults('<div data-og-card><p style="font-size: 15px">Card</p></div>')).toEqual([])
  })

  test('a band title takes the page rung, a phone its own', async () => {
    const band = (size: number) =>
      `<h1 class="su-chapter-band__title" style="font-size: ${size}px">Mule</h1>`
    expect(await faults(band(64))).toEqual([])
    expect(await faults(band(38), { phone: true })).toEqual([])
    expect(await faults(band(38))).toEqual([
      'title-size: 38px, not 64px, h1.su-chapter-band__title "Mule"',
    ])
  })

  test('a Mini name off chip size is named', async () => {
    const found = await faults(
      '<h3 class="su-entity-mini__name" style="font-size: 14px">Bonesaw</h3>'
    )
    expect(found).toContain('title-size: 14px, not 13px, h3.su-entity-mini__name "Bonesaw"')
  })
})

describe('Slabs (§4.9)', () => {
  test('a Slab stamp is body size, a Mini Slab chip size', async () => {
    const slab = (mini: boolean, size: number) => `
      <section class="su-slab-section${mini ? ' su-slab-section--mini' : ''}">
        <div data-slab><span class="su-poster-stamp" style="font-size: ${size}px">Gear</span></div>
      </section>`
    expect(await faults(slab(false, 14))).toEqual([])
    expect(await faults(slab(true, 12))).toEqual([])
    expect(await faults(slab(false, 12))).toEqual([
      'slab-size: 12px, not 14px, span.su-poster-stamp "Gear"',
    ])
  })

  test('a full Slab section in another is nested', async () => {
    const found = await faults(`
      <section class="su-slab-section">
        <div data-slab><span class="su-poster-stamp">Outer</span></div>
        <div><section class="su-slab-section">
          <div data-slab><span class="su-poster-stamp">Inner</span></div>
        </section></div>
      </section>`)
    expect(found).toEqual(['nested-slab: span.su-poster-stamp "Inner" in a Slab section'])
  })
})

describe('headings (E25, R53)', () => {
  test('a skipped level is named', async () => {
    const found = await faults(
      '<h1>Page</h1><h3 class="su-entity-mini__name" style="font-size: 13px">Deep</h3>'
    )
    expect(found).toEqual(['heading-skip: h1 then h3 h3.su-entity-mini__name "Deep"'])
  })

  test('a heading no form owns is stray; a screen-reader heading is not', async () => {
    expect(await faults('<h1>Page</h1><h2>Loose</h2>')).toEqual(['stray-head: h2 "Loose"'])
    expect(await faults('<h1>Page</h1><h2 data-box="0,0,1,1">Read aloud</h2>')).toEqual([])
  })

  test("a heading at its section's own level is too shallow", async () => {
    const found = await faults(`
      <h1>Page</h1>
      <section class="su-slab-section">
        <div data-slab><h2><span class="su-poster-stamp">Gear</span></h2></div>
        <div data-slab-body><h2 class="su-entity-compact__title" style="font-size: 22px">Kit</h2></div>
      </section>`)
    expect(found).toEqual(['heading-depth: h2 in an h2 section h2.su-entity-compact__title "Kit"'])
  })

  test('a hidden heading is not read', async () => {
    expect(await faults('<h1>Page</h1><div hidden><h4>Gone</h4></div>')).toEqual([])
  })
})

describe('emphasis (§3.13, §3.14)', () => {
  const rust = 'background-color: var(--color-rust)'

  test('a Use is rust; a make never is', async () => {
    expect(await faults(`<button style="${rust}">Use</button>`)).toEqual([])
    expect(await faults('<button>Use</button>')).toEqual(['use-rust: button "Use"'])
    expect(await faults('<button disabled>Use</button>')).toEqual([])
    expect(await faults(`<button style="${rust}">+ New Pilot</button>`)).toEqual([
      'door-rust: button "+ New Pilot" is rust; a make is outlined',
    ])
  })

  test('a rust control on a colour band wears the ink keyline; on paper it need not', async () => {
    const on = (ground: string, edge = '') =>
      `<div style="background-color: ${ground}"><button style="${rust}; ${edge}">Use</button></div>`
    expect(await faults(on('var(--color-paper)'))).toEqual([])
    expect(await faults(on('rgb(80, 140, 200)'))).toEqual(['band-keyline: button "Use"'])
    expect(await faults(on('rgb(80, 140, 200)', 'border-top: 1px solid var(--color-ink)'))).toEqual(
      []
    )
  })

  test('a button painted as the read stamp beside it is its twin', async () => {
    const ink = 'background-color: rgb(20, 20, 20); color: rgb(250, 250, 250)'
    const found = await faults(`
      <span class="su-badge" style="${ink}" data-box="0,0,40,20">TL 2</span>
      <button style="${ink}" data-box="50,0,60,20">Swap</button>`)
    expect(found).toEqual(['stamp-twin: button "Swap" beside span.su-badge "TL 2"'])
  })

  test('a twin far along the line, or in a head strip, is not one', async () => {
    const ink = 'background-color: rgb(20, 20, 20); color: rgb(250, 250, 250)'
    expect(
      await faults(`
      <span class="su-badge" style="${ink}" data-box="0,0,40,20">TL 2</span>
      <button style="${ink}" data-box="300,0,60,20">Swap</button>`)
    ).toEqual([])
    expect(
      await faults(`<div class="su-entity-compact__head">
        <span class="su-badge" style="${ink}" data-box="0,0,40,20">TL 2</span>
        <button style="${ink}" data-box="50,0,60,20">Swap</button></div>`)
    ).toEqual([])
  })
})

describe('the band title on the page', () => {
  test("a Reference title's words left of the measure are named", async () => {
    // happy-dom's window is 0px wide: the measure starts at its left edge.
    const band =
      '<header class="su-chapter-band"><h1 class="su-chapter-band__title" style="font-size: 64px">Mule</h1></header>'
    expect(await faults(band, { context: 'reference' })).toEqual([])
  })

  test('on a phone, content under the first screen is named; content on it passes', async () => {
    const page = (top: number) => `
      <header class="su-chapter-band" data-box="0,0,390,100">
        <h1 class="su-chapter-band__title" style="font-size: 38px">Mule</h1>
      </header>
      <main><p data-box="0,${top},390,20">The first words</p></main>`
    expect(await faults(page(200), { phone: true })).toEqual([])
    expect(await faults(page(2000), { phone: true })).toEqual([
      `first-screen: the first content starts at 2000px, under a ${innerHeight}px screen`,
    ])
  })
})

describe('the acts on a page (§3.14)', () => {
  test('each labelled Button reads as its act and variant; a make is one family', async () => {
    document.body.innerHTML = `
      <button class="su-btn su-btn--primary">Share</button>
      <button class="su-btn su-btn--default">+ New Mech</button>
      <button class="su-btn su-btn--ghost" aria-pressed="true">Edit</button>
      <button class="su-btn su-btn--primary" data-role-door>Mediate</button>
      <button class="su-btn">No variant</button>
      <button class="su-btn su-btn--quiet" data-box="0,0,1,1">Tiny</button>`
    expect(await readActs(page, { family: 'build', where: '/build/' })).toEqual([
      { act: 'share', variant: 'primary', family: 'build', where: '/build/' },
      { act: '+ New…', variant: 'default', family: 'build', where: '/build/' },
    ])
  })
})
