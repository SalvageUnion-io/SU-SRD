/**
 * The Ledger's render check (`_ledger.ts`, hard rule R63) on hand-made
 * readings: a well-formed Ledger passes; each rule fails on its own fault.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { LedgerRead } from '../_ledger'
import { findLedgerFaults, findLedgers } from '../_ledger'
import { documentPage } from './_page'

const GOOD: LedgerRead = {
  label: 'Systems',
  title: 'Systems',
  stamps: ['Slots', 'SV', 'Action', 'RNG', 'DMG', 'Traits', 'Cost'],
  sorts: false,
  underSlab: false,
  framedRows: 0,
  blankCells: 0,
  unpicked: 0,
}

const faults = (read: Partial<LedgerRead>, index = false) =>
  findLedgerFaults([{ ...GOOD, ...read }], { index })

describe('the Ledger at render', () => {
  test('a well-formed Ledger passes', () => {
    expect(faults({})).toEqual([])
  })

  test('frame: a row that frames itself', () => {
    expect(faults({ framedRows: 2 })).toEqual(['frame: Systems: 2 framed row(s)'])
  })

  test('tab: no title, or a Slab over the tab', () => {
    expect(faults({ title: '' })).toEqual(['tab: Systems: no title on its tab'])
    expect(faults({ underSlab: true })).toEqual(['tab: Systems: a Slab stands over its tab'])
  })

  test('order: a column out of the stat order', () => {
    expect(faults({ stamps: ['Slots', 'Cost', 'RNG', 'DMG'] })).toEqual([
      'order: Systems: RNG after Cost',
      'order: Systems: DMG after Cost',
    ])
  })

  test('empty: a blank cell', () => {
    expect(faults({ blankCells: 3 })).toEqual(['empty: Systems: 3 blank cell(s)'])
  })

  test('picked: a picked row that is not inked', () => {
    expect(faults({ unpicked: 1 })).toEqual(['picked: Systems: 1 picked row(s) not inked'])
  })

  test('sort: a head stamp sorts only on an SRD index', () => {
    expect(faults({ sorts: true })).toEqual(['sort: Systems: a head stamp sorts off an SRD index'])
    expect(faults({ sorts: true }, true)).toEqual([])
  })
})

describe('the Ledger as the page draws it', () => {
  const { page, restore } = documentPage()
  afterAll(restore)

  const ledger = (label: string, head: string, rows: string) =>
    `<div class="su-ledger"><table aria-label="${label}"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`
  const title = (name: string) =>
    `<th><span class="su-entity-compact__notch"><span class="su-entity-compact__title">${name}</span></span></th>`

  test('reads the title, the stamps and each row; a hidden Ledger is not read', async () => {
    document.body.innerHTML = [
      ledger(
        'Systems',
        `${title('Systems')}<th>Slots</th><th>SV</th><th data-kind="trailing"></th>`,
        '<tr><th>Welder</th><td>1</td><td>2</td><td data-kind="trailing"></td></tr><tr class="su-ledger__detail"><td></td></tr>'
      ),
      `<div aria-hidden="true">${ledger('Hidden', '<th></th>', '')}</div>`,
      '<div class="su-ledger"></div>',
    ].join('')
    expect(await findLedgers(page, { index: false })).toEqual([])
  })

  test('each fault is read off the markup', async () => {
    document.body.innerHTML = `<div class="su-slab-section__body">${ledger(
      'Modules',
      '<th></th><th>SV</th><th>Slots</th><th><button class="su-ledger__sort">EP</button></th>',
      '<tr><th>Scanner</th><td></td><td><div class="su-box"></div>1</td><td>2</td></tr>'
    )}</div>`
    const rules = (await findLedgers(page, { index: false })).map((finding) => finding.rule)
    expect(rules).toEqual(['frame', 'tab', 'tab', 'order', 'empty', 'sort'])
  })

  test('picked: a picked row wears ink and no seal', async () => {
    document.body.innerHTML = ledger(
      'Chassis',
      title('Chassis'),
      '<tr data-picked="" style="background-color: red"><th>Mule</th></tr>'
    )
    expect(await findLedgers(page, { index: false })).toEqual([
      { rule: 'picked', detail: 'picked: Chassis: 1 picked row(s) not inked' },
    ])
  })
})
