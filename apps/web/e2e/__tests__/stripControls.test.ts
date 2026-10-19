/**
 * The strip-control scan (`_stripControls.ts`, hard rule R6) on hand-written
 * markup in the forms' class names: a control in the chip group passes; one
 * on the head outside it is `beside`, one in the body `under`; and a control
 * drawn as the sibling of an entity's list item (or of the entity in a slot)
 * is `beside` it, or `under` it when it starts below.
 *
 * happy-dom lays nothing out, so every box is stubbed: an element's `data-top`
 * is its top, each box 20px high and wide.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { STRIP_CONTROL_SELECTORS, scanStripControls } from '../_stripControls'

const realRect = Element.prototype.getBoundingClientRect

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const own = this.closest('[data-top]')?.getAttribute('data-top')
    const top = Number(own ?? 0)
    return {
      top,
      bottom: top + 20,
      left: 0,
      right: 20,
      width: 20,
      height: 20,
      x: 0,
      y: top,
    } as DOMRect
  }
})

afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect
  // The document is shared with every later file in the run: leave it empty.
  document.body.innerHTML = ''
})

beforeEach(() => {
  document.body.innerHTML = ''
})

const row = (title: string, chips = '', body = '') =>
  `<div class="su-entity-row"><div class="su-entity-row__head"><span class="su-entity-row__title">${title}</span><div data-chip-group>${chips}</div></div>${body}</div>`

const scan = () => scanStripControls(STRIP_CONTROL_SELECTORS)

describe('strip-control scan', () => {
  test('a control in the chip group passes', () => {
    document.body.innerHTML = `<ul><li data-top="0">${row('Bonesaw', '<button>Copy to…</button>')}</li></ul>`
    expect(scan()).toEqual([])
  })

  test('a control in the item beside the entity is found', () => {
    document.body.innerHTML = `<ul><li data-top="0">${row('Bonesaw')}<select aria-label="Copy Bonesaw to…"></select></li></ul>`
    expect(scan()).toEqual(['beside: select "Copy Bonesaw to…" beside “Bonesaw”'])
  })

  test('a control in the body is under the strip', () => {
    document.body.innerHTML = `<ul><li data-top="0">${row('Bonesaw', '', '<div><button>Details</button></div>')}</li></ul>`
    expect(scan()).toEqual(['under: button "Details" under the strip of “Bonesaw”'])
  })

  test('a sibling item right after an entity’s item is found', () => {
    document.body.innerHTML = `<ul><li data-top="0">${row('Bonesaw')}</li><li data-top="40"><button>Copy to…</button></li></ul>`
    expect(scan()).toEqual(['under: button "Copy to…" under “Bonesaw”, a sibling'])
  })

  test('a control right after an entity in a slot is found', () => {
    document.body.innerHTML = `<div data-top="0"><div data-top="0">${row('Mazona')}</div><button data-top="0">Change</button></div>`
    expect(scan()).toEqual(['beside: button "Change" beside “Mazona”, a sibling'])
  })

  test('a list of entities passes, and a nested entity is its parent’s', () => {
    document.body.innerHTML = `<ul><li data-top="0">${row('Bonesaw', row('Engineer'))}</li><li data-top="40">${row('Driftwood')}</li></ul>`
    expect(scan()).toEqual([])
  })

  test('an entity in a Card is the Card’s: the Card’s controls beside it pass', () => {
    document.body.innerHTML = `<div class="su-ec-frame" data-top="0"><div>${row('Crew')}</div><button data-top="40">Repair</button></div>`
    expect(scan()).toEqual([])
  })

  test('a slot ends at a section: the page’s controls beyond it pass', () => {
    document.body.innerHTML = `<div data-top="0"><section data-top="0">${row('Propose a change')}</section><button data-top="40">Tables</button></div>`
    expect(scan()).toEqual([])
  })
})
