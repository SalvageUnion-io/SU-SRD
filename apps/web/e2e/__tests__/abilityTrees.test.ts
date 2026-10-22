/**
 * The ability-tree scan (`_abilityTrees.ts`) on hand-written markup in the
 * track's class names: trees in their own columns, three across, pass; a
 * fourth tree on the line and a tier pushed down a shared row each fault.
 *
 * happy-dom lays nothing out, so every box is stubbed: an element's
 * `data-box="left top bottom"` is its box, each 100px wide.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { ABILITY_TREE_SELECTORS, MAX_ACROSS, SLACK, scanAbilityTrees } from '../_abilityTrees'

const realRect = Element.prototype.getBoundingClientRect

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const box = this.getAttribute('data-box')
    if (!box) return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 } as DOMRect
    const [left = 0, top = 0, bottom = 0] = box.split(' ').map(Number)
    return {
      top,
      bottom,
      left,
      right: left + 100,
      width: 100,
      height: bottom - top,
      x: left,
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

/** One tree at `left`, its tiers' Minis at these [top, bottom]s, 12px gap. */
const tree = (name: string, left: number, tiers: [number, number][], track = 'core') => `
  <section class="su-ability-tree__group" data-box="${left} 0 400">
    <div data-slab=""><h3>${name}</h3><span>Tree</span></div>
    <ol class="su-ability-track" data-track="${track}" style="row-gap: 12px" data-box="${left} 30 400">
      ${tiers
        .map(
          ([top, bottom]) =>
            `<li class="su-ability-track__tier" data-box="${left} ${top} ${bottom}"><div class="su-entity-mini" data-box="${left} ${top} ${bottom}"></div></li>`
        )
        .join('')}
    </ol>
  </section>`

const STACKED: [number, number][] = [
  [30, 80],
  [92, 140],
  [152, 200],
]

const scan = () =>
  scanAbilityTrees({ a: ABILITY_TREE_SELECTORS, maxAcross: MAX_ACROSS, slack: SLACK })

describe('scanAbilityTrees', () => {
  test('three trees across, each stacked in its own column, pass', () => {
    document.body.innerHTML = `<div>${[0, 120, 240].map((x, i) => tree(`T${i}`, x, STACKED)).join('')}</div>`
    expect(scan()).toEqual([])
  })

  test('a fourth tree on the line is a fault; one wrapped under is not', () => {
    document.body.innerHTML = `<div>${[0, 120, 240, 360].map((x, i) => tree(`T${i}`, x, STACKED)).join('')}</div>`
    expect(scan()).toEqual(['across: 4 trees on one line (T0, T1, T2, T3)'])
    document.body.innerHTML = `<div>${[0, 120, 240].map((x, i) => tree(`T${i}`, x, STACKED)).join('')}
      <section class="su-ability-tree__group" data-box="0 500 900">
        <div data-slab=""><h3>T3</h3></div>
        <ol class="su-ability-track" data-track="core" style="row-gap: 12px" data-box="0 530 900"></ol>
      </section></div>`
    expect(scan()).toEqual([])
  })

  test('a tier pushed down a shared row is a fault', () => {
    document.body.innerHTML = `<div>${tree('Salvaging', 0, [
      [30, 80],
      [300, 350],
      [362, 410],
    ])}</div>`
    expect(scan()).toEqual([
      "column: Salvaging's tier 2 stands 220px under tier 1, past its 12px gap",
    ])
  })

  test("a Legendary track's equal rows are not read", () => {
    document.body.innerHTML = `<div>${tree(
      'Legendary',
      0,
      [
        [30, 80],
        [300, 350],
      ],
      'legendary'
    )}</div>`
    expect(scan()).toEqual([])
  })
})
