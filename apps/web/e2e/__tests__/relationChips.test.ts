/**
 * The relation scan (`_relationChips.ts`, hard rule R5) on hand-written markup
 * in the forms' class names: an entity in a Row's body, a Token hung under a
 * Row, and what passes (a list of Rows, a Token in a Row's head, a TitledBox).
 */
import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { RELATION_SELECTORS, scanRelations } from '../_relationChips'

afterAll(() => {
  // The document is shared with every later file in the run: leave it empty.
  document.body.innerHTML = ''
})

beforeEach(() => {
  document.body.innerHTML = ''
})

const token = (name: string) =>
  `<div class="su-entity-token"><span class="su-entity-token__name">${name}</span></div>`

const row = (title: string, body = '', chips = '') =>
  `<div class="su-entity-row__frame"><div class="su-entity-row__main"><div class="su-entity-row__head"><h3 class="su-entity-row__title">${title}</h3>${chips}</div>${body}</div></div>`

const scan = () => scanRelations(RELATION_SELECTORS)

describe('relation scan', () => {
  test('a Token hung under a Row is found', () => {
    document.body.innerHTML = `<div><div>${row('Bonesaw')}</div>${token('Mazona')}</div>`
    expect(scan()).toEqual([{ rule: 'under', detail: '“Mazona” hangs under “Bonesaw”' }])
  })

  test('an entity in a Row’s body is found', () => {
    document.body.innerHTML = row('Bonesaw', `<div>${token('Mazona')}</div>`)
    expect(scan()).toEqual([{ rule: 'nested', detail: '“Bonesaw” holds an entity in its body' }])
  })

  test('a list of Rows, and a chip in a Row’s head, pass', () => {
    document.body.innerHTML = `<ul><li>${row('Bonesaw', '', token('Engineer'))}</li><li>${row('Driftwood')}</li></ul>`
    expect(scan()).toEqual([])
  })

  test('a TitledBox wears the frame class but is no Row', () => {
    document.body.innerHTML = `<section class="su-entity-row su-box">${row('When Damaged', `<div>${token('Mazona')}</div>`)}</section>`
    expect(scan()).toEqual([])
  })
})
