/**
 * The sheet-grammar scan (`_sheetGrammar.ts`, hard rule R11) on hand-written
 * markup in `LiveSheet`'s class names: the shell, the hero and its vitals,
 * Read's typeset body, Edit's one remove control and the sidebar. The browser run
 * (`sheet-grammar.e2e.ts`) walks every sheet kind; this holds what each rule
 * finds without one.
 */
import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { EMPTY_LINES, SHEET_VITAL_WORDS, scanSheetGrammar } from '../_sheetGrammar'

afterAll(() => {
  // The document is shared with every later file in the run: leave it empty.
  document.body.innerHTML = ''
})

beforeEach(() => {
  document.body.innerHTML = ''
})

const READ_EDIT = '<fieldset><legend>Read or edit this sheet</legend></fieldset>'
const SHARE = '<button aria-label="Share this sheet">Share</button>'

/** A vital gauge captioned `words`, with a pip inside it. */
const vital = (key: string, words: string) =>
  `<div data-vital="${key}"><span data-pip></span>${words}</div>`

const HERO = `<div class="su-sheet-hero"><div class="su-sheet-vitals">${vital('hp', 'HP Hit Points')}${vital('ap', 'AP Ability Points')}</div></div>`

/** A Live Sheet of `kind`: its band's corner, then its body. */
const sheet = ({
  corner = `${READ_EDIT}${SHARE}`,
  body = HERO,
  kind = 'pilot',
}: {
  corner?: string | null
  body?: string | null
  kind?: string
}) => {
  const band = `<div class="su-chapter-band">${
    corner === null ? '' : `<div class="su-chapter-band__corner">${corner}</div>`
  }</div>`
  const live = body === null ? '' : `<div class="su-sheet-live-body">${body}</div>`
  return `<main data-variant="${kind}">${band}${live}</main>`
}

const scan = (html: string, edit = false, carries = false) => {
  document.body.innerHTML = html
  return scanSheetGrammar({ edit, carries, words: SHEET_VITAL_WORDS, emptyLines: EMPTY_LINES })
}
const details = (html: string, edit = false) =>
  scan(html, edit).map((f) => `${f.rule}: ${f.detail}`)

describe('shell', () => {
  test('a Live Sheet with its corner, Read | Edit and hero is within the law', () => {
    expect(scan(sheet({}))).toEqual([])
    expect(scan(sheet({}), true)).toEqual([])
  })

  test('a page that is no Live Sheet is one finding', () => {
    expect(details('<main><h1>Pilot</h1></main>')).toEqual([
      'shell: no LiveSheet (`main[data-variant]`)',
    ])
  })

  test('a band with no corner, and a sheet with no body, are findings', () => {
    expect(details(sheet({ corner: null, body: null, kind: 'mech' }))).toEqual([
      'shell: mech: the band has no corner',
      'shell: mech: no sheet body',
    ])
  })

  test('a writable sheet offers Read | Edit', () => {
    expect(details(sheet({ corner: SHARE }))).toEqual([
      'shell: pilot: a writable sheet with no Read | Edit',
    ])
    // A sheet the viewer may only read has no Share, so no switch is owed.
    expect(scan(sheet({ corner: '' }))).toEqual([])
  })

  test("Share and Delete are the corner's, never the body's", () => {
    const body = `${HERO}<button>Delete pilot</button><button aria-label="Share">⤴</button><button>Shared notes</button>`
    expect(details(sheet({ body }))).toEqual([
      'shell: pilot: "Delete pilot" in the body',
      'shell: pilot: "Share" in the body',
    ])
  })
})

describe('hero and vitals', () => {
  test('the body opens on a SheetHero with its vitals stack', () => {
    expect(details(sheet({ body: '<p>Bonesaw</p>' }))).toEqual([
      'hero: pilot: the body opens on no SheetHero',
    ])
    expect(details(sheet({ body: '<div class="su-sheet-hero"></div>' }))).toEqual([
      'hero: pilot: no vitals stack',
    ])
  })

  test('a pip outside a vital gauge is one finding, however many there are', () => {
    const body = `<div class="su-sheet-hero"><div class="su-sheet-vitals"></div><span data-pip></span><span data-pip></span></div>`
    expect(details(sheet({ body }))).toEqual(['vitals: pilot: a gauge that is no SheetVitalGauge'])
  })

  test('each vital is captioned in the full words of the one map', () => {
    const body = `<div class="su-sheet-hero"><div class="su-sheet-vitals">${vital('sp', 'SP')}${vital('heat', 'HEAT heat   capacity')}${vital('morale', 'Morale')}</div></div>`
    expect(details(sheet({ body, kind: 'mech' }))).toEqual([
      'vitals: mech: sp not captioned "Structure Points"',
      'vitals: mech: a vital "morale" off the map',
    ])
  })
})

describe('Read and Edit', () => {
  test('Read is typeset: no field, slider, stepper or empty section', () => {
    const body = [
      HERO,
      '<input aria-label="Callsign" />',
      '<input type="hidden" name="id" />',
      '<textarea name="notes"></textarea>',
      '<div role="slider" aria-label="Hit Points"></div>',
      '<button aria-label="Increase Hit Points">+</button>',
      `<p>${EMPTY_LINES[0]}</p>`,
    ].join('')
    expect(details(sheet({ body }))).toEqual([
      'read: pilot: a field in Read (Callsign)',
      'read: pilot: a field in Read (notes)',
      'read: pilot: a field in Read (Hit Points)',
      'read: pilot: a stepper in Read (Increase Hit Points)',
      `read: pilot: an empty section in Read ("${EMPTY_LINES[0]}")`,
    ])
  })

  test('Edit may hold fields, and its every remove control is SheetRemoveButton', () => {
    const body = [
      HERO,
      '<input aria-label="Callsign" />',
      '<button aria-label="Remove Ration Pack" class="su-sheet-item__remove"></button>',
      '<button aria-label="Remove Grappling Hook"></button>',
      '<button aria-label="Remove photo"></button>',
      '<button aria-label="Add gear"></button>',
    ].join('')
    expect(details(sheet({ body }), true)).toEqual([
      'remove: pilot: "Remove Grappling Hook" is not the one remove control',
    ])
  })
})

describe('the sidebar', () => {
  const realMatchMedia = window.matchMedia
  afterAll(() => {
    window.matchMedia = realMatchMedia
  })

  /** The viewport is at or past the 64rem rung, or under it. */
  const wide = (on: boolean) => {
    window.matchMedia = ((query: string) => ({ matches: on, media: query })) as never
  }

  /** Give the element `selector` matches a box (happy-dom lays nothing out). */
  const place = (selector: string, [left = 0, top = 0, width = 0, height = 0]: number[]) => {
    const el = document.querySelector(selector)
    if (!el) throw new Error(`nothing matches ${selector}`)
    el.getBoundingClientRect = () =>
      ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect
  }

  const columns = (aside: string | null, main = '<section>Abilities</section>') =>
    `<div class="su-sheet-columns"><div class="su-sheet-columns__hero">${HERO}</div>${
      aside === null ? '' : `<aside data-sheet-aside="">${aside}</aside>`
    }<div class="su-sheet-columns__main">${main}</div></div>`

  const CARRIED = '<ul data-sheet-carried="" aria-label="Bonesaw\'s equipment"></ul>'

  const laidOut = (html: string, boxes: Record<string, number[]>, carries = true) => {
    document.body.innerHTML = html
    for (const [selector, box] of Object.entries(boxes)) place(selector, box)
    return scanSheetGrammar({
      edit: false,
      carries,
      words: SHEET_VITAL_WORDS,
      emptyLines: EMPTY_LINES,
    }).map((f) => `${f.rule}: ${f.detail}`)
  }

  test('at page width it is a column beside the main column, under the opening', () => {
    wide(true)
    const html = sheet({ body: columns(CARRIED) })
    const hero = {
      '.su-sheet-columns__hero': [0, 0, 1276, 400],
      '.su-sheet-columns__main': [0, 424, 900, 800],
    }
    expect(laidOut(html, { ...hero, '[data-sheet-aside]': [924, 424, 352, 600] })).toEqual([])
    expect(laidOut(html, { ...hero, '[data-sheet-aside]': [0, 1248, 900, 300] })).toEqual([
      'aside: pilot: the sidebar is not beside the sheet',
    ])
    expect(laidOut(html, { ...hero, '[data-sheet-aside]': [924, 0, 352, 600] })).toEqual([
      'aside: pilot: the sidebar is not under the opening',
    ])
  })

  test('on a phone it stacks under the opening, over the main column', () => {
    wide(false)
    const html = sheet({ body: columns(CARRIED) })
    const hero = { '.su-sheet-columns__hero': [16, 0, 358, 600] }
    expect(
      laidOut(html, {
        ...hero,
        '[data-sheet-aside]': [16, 624, 358, 300],
        '.su-sheet-columns__main': [16, 948, 358, 800],
      })
    ).toEqual([])
    expect(
      laidOut(html, {
        ...hero,
        '[data-sheet-aside]': [16, 1800, 358, 300],
        '.su-sheet-columns__main': [16, 624, 358, 800],
      })
    ).toEqual(['aside: pilot: the sidebar is not stacked under the opening'])
  })

  test('a sheet that carries something has one, collapsed never, folding nothing', () => {
    wide(true)
    expect(laidOut(sheet({ body: columns(null) }), {})).toEqual(['aside: pilot: no sidebar'])
    expect(laidOut(sheet({ body: columns(CARRIED) }), {})).toEqual([
      'aside: pilot: the sidebar is collapsed',
    ])
    const folding = `<div class="su-slab-section__head su-slab-section__head--fold"></div>${CARRIED}`
    expect(
      laidOut(sheet({ body: columns(folding) }), {
        '.su-sheet-columns__hero': [0, 0, 900, 400],
        '.su-sheet-columns__main': [0, 424, 900, 800],
        '[data-sheet-aside]': [924, 424, 352, 600],
      })
    ).toEqual(['aside: pilot: a section in the sidebar folds'])
  })

  test('what the unit carries is in the sidebar, and a sheet carrying nothing has none', () => {
    wide(true)
    const outside = columns('<p>Kit</p>', `<div data-storage-side="mech"></div>`)
    expect(
      laidOut(sheet({ body: outside, kind: 'mech' }), {
        '.su-sheet-columns__hero': [0, 0, 900, 400],
        '.su-sheet-columns__main': [0, 424, 900, 800],
        '[data-sheet-aside]': [924, 424, 352, 600],
      })
    ).toEqual(['aside: mech: carried things outside the sidebar (mech)'])
    expect(laidOut(sheet({ body: columns(null), kind: 'npc' }), {}, false)).toEqual([])
    expect(
      laidOut(
        sheet({ body: columns('<p>Kit</p>'), kind: 'npc' }),
        {
          '.su-sheet-columns__hero': [0, 0, 1276, 400],
          '.su-sheet-columns__main': [0, 424, 900, 800],
          '[data-sheet-aside]': [924, 424, 352, 600],
        },
        false
      )
    ).toEqual(['aside: npc: a sidebar on a sheet that carries nothing'])
  })
})
