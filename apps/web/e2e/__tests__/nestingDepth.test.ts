/**
 * The nesting scan's structure (`_nestingDepth.ts`): which headed frames it
 * finds, how it counts their levels and names their chains, and the N1, N3,
 * N5, N6 and N7 findings, on hand-written markup in the forms' class names.
 *
 * happy-dom lays nothing out, so every element gets a box of its own, each on
 * its own row, and nothing is ever "narrower than its line": N4 and the
 * visibility of a collapsed box are layout, measured only in a browser
 * (`nesting-depth.e2e.ts`).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { NestingFinding } from '../_nestingDepth'
import { NESTING_SELECTORS, scanNesting } from '../_nestingDepth'

const original = Element.prototype.getBoundingClientRect

beforeAll(() => {
  const rows = new WeakMap<Element, number>()
  let next = 0
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const row = rows.get(this) ?? next++
    rows.set(this, row)
    return new DOMRect(0, row * 40, 100, 20)
  }
})

afterAll(() => {
  Element.prototype.getBoundingClientRect = original
  // The document is shared with every later file in the run: leave it empty.
  document.body.innerHTML = ''
})

beforeEach(() => {
  document.body.innerHTML = ''
})

/** A Head band titled `title`, its kind read as `KindLabel` reads it. */
const head = (title: string, kind?: string) =>
  `<div class="su-entity-row__head"><h3 class="su-entity-row__title">${title}${
    kind ? `<span class="su-sr-only"> (${kind})</span>` : ''
  }</h3></div>`

/** A Card: its head, then `body`. */
const card = (title: string, kind: string, body = '') =>
  `<div class="su-ec-frame">${head(title, kind)}${body}</div>`

/** A Row: its frame, its head, then `body`. */
const row = (title: string, kind: string, body = '') =>
  `<div class="su-entity-row"><div class="su-entity-row__frame"><div class="su-entity-row__main">${head(title, kind)}${body}</div></div></div>`

/** A Box, titled when `title` is given. */
const box = (body: string, title?: string, className = '') =>
  `<div class="su-entity-row su-box ${className}"><div class="su-entity-row__frame"><div class="su-entity-row__main">${
    title ? head(title) : ''
  }<div class="su-box__body">${body}</div></div></div></div>`

const token = (name: string, kind: string, body = '') =>
  `<a class="su-entity-token"><span class="su-entity-token__pill"><span class="su-entity-token__name">${name}<span class="su-sr-only"> (${kind})</span></span></span>${body}</a>`

const scan = (html: string): NestingFinding[] => {
  document.body.innerHTML = html
  return scanNesting(NESTING_SELECTORS)
}

describe('N1: three levels', () => {
  test('a Page holding a Card holding Tokens is within the law', () => {
    expect(
      scan(`<main>${card('Big Brother', 'Chassis', token('Shield Drone', 'Drone'))}</main>`)
    ).toEqual([])
  })

  test('a Row inside a Card is a headed frame at level 2', () => {
    const html = card('Shield Drone', 'Drone', row('Refractive Shield Projector', 'System'))
    expect(scan(html)).toEqual([
      {
        rule: 'N1',
        chain: 'Shield Drone (Drone) > Refractive Shield Projector (System)',
        detail: 'a headed frame at level 2',
      },
    ])
  })

  test('each level past the second is its own finding, with its whole chain', () => {
    const html = card(
      'Big Brother',
      'Chassis',
      card('Shield Drone', 'Drone', row('Hover', 'System'))
    )
    expect(scan(html).map((f) => `${f.chain}: ${f.detail}`)).toEqual([
      'Big Brother (Chassis) > Shield Drone (Drone): a headed frame at level 2',
      'Big Brother (Chassis) > Shield Drone (Drone) > Hover (System): a headed frame at level 3',
    ])
  })

  test("a dialog's head is level 0, so its Rows are level 1", () => {
    const html = `<div role="dialog">${box(row('Mini Mortar', 'Weapon System'), 'Mount a weapon', 'su-modal-panel')}</div>`
    expect(scan(html)).toEqual([])
  })

  test("a dialog's chrome names the chain without counting as a level", () => {
    const html = box(
      card('Mini Mortar', 'Weapon System', row('Fire', 'Action')),
      'Mount',
      'su-modal-panel'
    )
    expect(scan(html)).toEqual([
      {
        rule: 'N1',
        chain: 'Mount (dialog) > Mini Mortar (Weapon System) > Fire (Action)',
        detail: 'a headed frame at level 2',
      },
    ])
  })

  test('an untitled Box is no level', () => {
    expect(scan(box(card('Mule', 'Chassis', token('Cargo Pod', 'System'))))).toEqual([])
  })

  test("a class page's path card is a level-1 Box: its track's Rows are level 2", () => {
    const html = `<ul><li class="su-class-path">${box(row('Jury Rig', 'Ability'), 'Legendary Engineer')}</li></ul>`
    expect(scan(html)).toEqual([
      {
        rule: 'N1',
        chain: 'Legendary Engineer (TitledBox) > Jury Rig (Ability)',
        detail: 'a headed frame at level 2',
      },
    ])
  })

  test("a path card's track of contentful Tokens is within the law", () => {
    const track = token(
      'Jury Rig',
      'Ability',
      '<div class="su-entity-token__body"><p>Fix it.</p></div>'
    )
    const html = `<ul><li class="su-class-path">${box(track, 'Legendary Engineer')}</li></ul>`
    expect(scan(html)).toEqual([])
  })

  test('a hidden subtree is not read', () => {
    const html = `<div aria-hidden="true">${card('Shield Drone', 'Drone', row('Hover', 'System'))}</div>`
    expect(scan(html)).toEqual([])
  })
})

describe('N3: a Token nests nothing', () => {
  test('a Row inside a contentful Token is an entity inside a Token', () => {
    const html = token(
      'Crew Lead',
      'NPC',
      `<div class="su-entity-token__body">${row('Fire', 'Action')}</div>`
    )
    expect(scan(html)).toContainEqual({
      rule: 'N3',
      chain: 'Crew Lead (NPC) > Fire (Action)',
      detail: 'an entity inside a Token',
    })
  })

  test("a contentful Token's text is no entity", () => {
    const html = token(
      'Fire',
      'Action',
      '<div class="su-entity-token__body"><p>Deal 3 SP.</p></div>'
    )
    expect(scan(card('Mini Mortar', 'Weapon System', html))).toEqual([])
  })
})

describe('N5: no titled box inside an entity', () => {
  test("a bay card's When Damaged TitledBox breaks N5 and N1", () => {
    const html = card('Armament Bay', 'Crawler Bay', box('<p>The bay is down.</p>', 'When Damaged'))
    expect(scan(html)).toEqual([
      {
        rule: 'N1',
        chain: 'Armament Bay (Crawler Bay) > When Damaged (TitledBox)',
        detail: 'a headed frame at level 2',
      },
      {
        rule: 'N5',
        chain: 'Armament Bay (Crawler Bay) > When Damaged (TitledBox)',
        detail: 'a TitledBox inside an entity',
      },
    ])
  })

  test('a TitledBox on a Page, at level 1, is allowed', () => {
    expect(scan(`<main>${box('<p>The bay is down.</p>', 'When Damaged')}</main>`)).toEqual([])
  })
})

describe("N6: a wizard step's entities are untitled", () => {
  test("a titled step box around the step's entities breaks N6", () => {
    const html = `<main class="su-wiz-main">${box(card('Mule', 'Chassis'), 'Craft your Mech Chassis')}</main>`
    expect(scan(html).filter((f) => f.rule === 'N6')).toEqual([
      {
        rule: 'N6',
        chain: 'Craft your Mech Chassis (TitledBox)',
        detail: "a TitledBox around a wizard step's entities",
      },
    ])
  })

  test("a titled box in a step that holds no entity is the step's own block", () => {
    const html = `<main class="su-wiz-main">${box('<p>Scrap: 10</p>', 'Scrap Pool')}${card('Mule', 'Chassis')}</main>`
    expect(scan(html)).toEqual([])
  })

  test('an untitled step box is within the law', () => {
    const html = `<main class="su-wiz-main">${box(card('Mule', 'Chassis', token('Cargo Pod', 'System')))}</main>`
    expect(scan(html)).toEqual([])
  })
})

describe('N7: a Token takes no select mode', () => {
  test('a radio or pressed Token breaks N7', () => {
    const radio = `<div role="radio" aria-checked="false" class="su-entity-token"><span class="su-entity-token__pill"><span class="su-entity-token__name">Hacker</span></span></div>`
    const pressed = `<div class="su-entity-token" data-contentful=""><a aria-pressed="true" class="su-entity-token__head"><span class="su-entity-token__pill"><span class="su-entity-token__name">Auger</span></span></a></div>`
    expect(scan(card('Pick', 'Class', radio + pressed)).filter((f) => f.rule === 'N7')).toEqual([
      { rule: 'N7', chain: 'Pick (Class) > Hacker', detail: 'a Token in select mode' },
      { rule: 'N7', chain: 'Pick (Class) > Auger', detail: 'a Token in select mode' },
    ])
  })

  test("an in-card choice's pressed Token toggle is allowed", () => {
    const toggle = `<div data-choice-toggle=""><div role="button" aria-pressed="true" class="su-entity-token"><span class="su-entity-token__pill"><span class="su-entity-token__name">Missile Pod</span></span></div></div>`
    expect(scan(card('Armament Bay', 'Crawler Bay', toggle))).toEqual([])
  })

  test('a radio Token under a choice-toggle mark still breaks N7', () => {
    const radio = `<div data-choice-toggle=""><div role="radio" aria-checked="true" class="su-entity-token"><span class="su-entity-token__pill"><span class="su-entity-token__name">Missile Pod</span></span></div></div>`
    expect(scan(card('Armament Bay', 'Crawler Bay', radio))).toEqual([
      {
        rule: 'N7',
        chain: 'Armament Bay (Crawler Bay) > Missile Pod',
        detail: 'a Token in select mode',
      },
    ])
  })

  test('a link Token, or a search option, is no select mode', () => {
    const option = `<a role="option" aria-selected="true" class="su-entity-token"><span class="su-entity-token__pill"><span class="su-entity-token__name">Mule</span></span></a>`
    expect(scan(card('Pick', 'Class', token('Hacker', 'Class') + option))).toEqual([])
  })
})

describe('N8: one level deep is a Row', () => {
  const page = (body: string) => `<main>${body}</main>`
  const deep = (html: string) => {
    document.body.innerHTML = html
    return scanNesting({ ...NESTING_SELECTORS, oneDeep: 'main' })
  }

  test("a Token straight on a Page, or in its section's TitledBox, breaks N8", () => {
    expect(deep(page(token('The Smith', 'NPC')))).toEqual([
      {
        rule: 'N8',
        chain: 'The Smith (NPC)',
        detail: 'a Token one level deep: a Row drawn open with all its content',
      },
    ])
    expect(deep(page(box(token('Hacker', 'Class'), 'Choose 1'))).map((f) => f.rule)).toEqual(['N8'])
  })

  test("a Row on a Page, a Token in a Card, a search list's Token and a Peek's are no N8", () => {
    const listbox = `<div role="listbox">${token('Mule', 'Chassis')}</div>`
    const peek = `<div data-peek-popup="">${token('Typhon', 'Bio-Titan')}</div>`
    expect(
      deep(
        page(row('The Smith', 'NPC', '<p>All its content</p>')) +
          page(card('Armoury', 'Crawler Bay', token('The Smith', 'NPC'))) +
          page(listbox + peek)
      )
    ).toEqual([])
  })

  test("a pattern's loadout and a class's ability trees are N8's named exception", () => {
    const loadout = `<div class="su-pattern-loadout">${token('Comms Module', 'Module')}</div>`
    const pageLoadout = `<div class="su-entity-page__loadout">${token('Railgun', 'System')}</div>`
    const tree = `<div class="su-ability-tree">${token('Worm', 'Ability')}</div>`
    expect(deep(page(box(loadout, 'Buzzard') + pageLoadout + tree))).toEqual([])
  })

  test('off a Page (oneDeep unset) a Token at level 1 is the form', () => {
    expect(scan(page(token('The Smith', 'NPC')))).toEqual([])
  })
})
