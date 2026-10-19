/**
 * The sheet-grammar scan (`_sheetGrammar.ts`, hard rule R11) on hand-written
 * markup in `LiveSheet`'s class names: the shell, the hero and its vitals,
 * Read's typeset body and Edit's one remove control. The browser run
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

const scan = (html: string, edit = false) => {
  document.body.innerHTML = html
  return scanSheetGrammar({ edit, words: SHEET_VITAL_WORDS, emptyLines: EMPTY_LINES })
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
