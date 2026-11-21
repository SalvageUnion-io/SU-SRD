/**
 * The fill-grid check (`_fillGrid.ts`, hard rule R68) on hand-made boxes: full
 * rows and a stretched last row pass; a centred, a left-packed or a
 * content-sized row fails, as do a hand-built grid's orphan cell and a
 * masonry's empty column.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { GridBoxes } from '../_fillGrid'
import { findFillGrid, findFillGridFaults } from '../_fillGrid'
import { documentPage } from './_page'

const LIST = { left: 0, right: 300, top: 0 }
const cell = (left: number, right: number, top: number) => ({ left, right, top })

const grid = (cells: GridBoxes['cells'], kind: GridBoxes['kind'] = 'fill'): GridBoxes[] => [
  { kind, label: 'Raider stats', list: LIST, cells },
]

const FULL = [cell(0, 90, 0), cell(105, 195, 0), cell(210, 300, 0)]

describe('the item grid fills its rows', () => {
  test('full rows and a last row stretched across the line pass', () => {
    // Three a row, seven items: the lone seventh takes the line.
    const cells = [
      ...FULL,
      cell(0, 90, 50),
      cell(105, 195, 50),
      cell(210, 300, 50),
      cell(0, 300, 100),
    ]
    expect(findFillGridFaults(grid(cells))).toEqual([])
  })

  test('two last-row items that share the line pass', () => {
    expect(findFillGridFaults(grid([...FULL, cell(0, 142.5, 50), cell(157.5, 300, 50)]))).toEqual(
      []
    )
  })

  test('a last row packed left fails, with what it leaves', () => {
    expect(findFillGridFaults(grid([...FULL, cell(0, 90, 50)]))).toEqual([
      'fill: Raider stats: row 2 of 2 (1 items) leaves 0px left, 210px right',
    ])
  })

  test('a centred row fails on both edges', () => {
    expect(findFillGridFaults(grid([cell(100, 200, 0)]))).toEqual([
      'fill: Raider stats: row 1 of 1 (1 items) leaves 100px left, 100px right',
    ])
  })

  test('a sub-pixel shortfall passes', () => {
    expect(findFillGridFaults(grid([cell(0.4, 299.5, 0)]))).toEqual([])
  })
})

describe('a hand-built grid of equal tracks', () => {
  test('a full last row passes; rows above it are not judged', () => {
    expect(
      findFillGridFaults(
        grid([...FULL, cell(0, 90, 50), cell(105, 195, 50), cell(210, 300, 50)], 'orphan')
      )
    ).toEqual([])
  })

  test('an orphan cell in its last row fails', () => {
    expect(findFillGridFaults(grid([...FULL, cell(0, 90, 50)], 'orphan'))).toEqual([
      'orphan: Raider stats: row 2 of 2 (1 items) leaves 0px left, 210px right',
    ])
  })

  test('an empty track beside a single row fails', () => {
    expect(findFillGridFaults(grid([cell(0, 90, 0), cell(105, 195, 0)], 'orphan'))).toEqual([
      'orphan: Raider stats: row 1 of 1 (2 items) leaves 0px left, 105px right',
    ])
  })
})

describe('a masonry', () => {
  const masonry = (cells: GridBoxes['cells']): GridBoxes[] => [
    { kind: 'column', label: 'Systems installed', list: LIST, cells, slack: 12 },
  ]

  test('a last column that is used passes, whatever the columns hold', () => {
    expect(
      findFillGridFaults(masonry([cell(0, 144, 0), cell(0, 144, 80), cell(156, 300, 0)]))
    ).toEqual([])
  })

  test('an empty column fails', () => {
    expect(findFillGridFaults(masonry([cell(0, 92, 0), cell(104, 196, 0)]))).toEqual([
      'column: Systems installed leaves 104px of columns empty',
    ])
  })

  test('nothing drawn is no fault', () => {
    expect(findFillGridFaults(masonry([]))).toEqual([])
  })
})

describe('the item grids as the page draws them', () => {
  const { page, restore } = documentPage()
  afterAll(restore)

  const item = (box: string, tag = 'li') => `<${tag} data-box="${box}">item</${tag}>`

  test('`.su-grid`: a full row passes, a short one is `fill`, named by its label', async () => {
    document.body.innerHTML = [
      `<ul class="su-grid" data-box="0,0,300,20">${item('0,0,150,20')}${item('150,0,150,20')}</ul>`,
      `<ul class="su-grid su-stat-column" aria-label="Mule stats" data-box="0,40,300,20">${item('0,40,90,20')}</ul>`,
    ].join('')
    expect(await findFillGrid(page)).toEqual([
      {
        rule: 'fill',
        detail: 'fill: Mule stats: row 1 of 1 (1 items) leaves 0px left, 210px right',
      },
    ])
  })

  test('a stat cell is read by the Stat it draws; a gauge and a hidden grid are not grids', async () => {
    document.body.innerHTML = [
      `<ul class="su-grid" data-box="0,0,300,20"><li data-box="0,0,300,20"><span class="su-stat-column__stat" data-box="0,0,120,20">SP</span></li></ul>`,
      `<div role="img"><span class="su-grid" data-box="0,0,300,20">${item('0,0,10,20', 'i')}</span></div>`,
      `<div aria-hidden="true"><ul class="su-grid" data-box="0,0,300,20">${item('0,0,10,20')}</ul></div>`,
    ].join('')
    expect(await findFillGrid(page)).toEqual([
      { rule: 'fill', detail: 'fill: ul: row 1 of 1 (1 items) leaves 0px left, 180px right' },
    ])
  })

  test('a hand-built grid of equal tracks with an empty last track is `orphan`', async () => {
    document.body.innerHTML = `<ul class="su-doors" style="display: grid; grid-template-columns: 100px 100px 100px" data-box="0,0,300,60">${item('0,0,100,20')}${item('100,0,100,20')}${item('200,0,100,20')}${item('0,30,100,20')}</ul>`
    expect(await findFillGrid(page)).toEqual([
      {
        rule: 'orphan',
        detail: 'orphan: ul.su-doors: row 2 of 2 (1 items) leaves 0px left, 200px right',
      },
    ])
  })

  test('a masonry with an empty column is `column`', async () => {
    document.body.innerHTML = `<ul class="su-masonry" data-box="0,0,300,60">${item('0,0,140,20')}</ul>`
    expect(await findFillGrid(page)).toEqual([
      { rule: 'column', detail: 'column: ul.su-masonry leaves 160px of columns empty' },
    ])
  })
})
