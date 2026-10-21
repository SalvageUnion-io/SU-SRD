/**
 * The relation scan (`_relationChips.ts`, hard rule R5) on hand-written markup
 * in the forms' class names: an entity in a Compact's body, a Mini hung under a
 * Compact, and what passes (a list of Compacts, a Mini in a Compact's head, a TitledBox).
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
  `<div class="su-entity-mini"><span class="su-entity-mini__name">${name}</span></div>`

const row = (title: string, body = '', chips = '') =>
  `<div class="su-entity-compact__frame"><div class="su-entity-compact__main"><div class="su-entity-compact__head"><h3 class="su-entity-compact__title">${title}</h3>${chips}</div>${body}</div></div>`

const scan = () => scanRelations(RELATION_SELECTORS)

describe('relation scan', () => {
  test('a Mini hung under a Compact is found', () => {
    document.body.innerHTML = `<div><div>${row('Bonesaw')}</div>${token('Mazona')}</div>`
    expect(scan()).toEqual([{ rule: 'under', detail: '“Mazona” hangs under “Bonesaw”' }])
  })

  test('an entity in a Compact’s body is found', () => {
    document.body.innerHTML = row('Bonesaw', `<div>${token('Mazona')}</div>`)
    expect(scan()).toEqual([{ rule: 'nested', detail: '“Bonesaw” holds an entity in its body' }])
  })

  test('a list of Compacts, and a chip in a Compact’s head, pass', () => {
    document.body.innerHTML = `<ul><li>${row('Bonesaw', '', token('Engineer'))}</li><li>${row('Driftwood')}</li></ul>`
    expect(scan()).toEqual([])
  })

  test('a linked unit’s Mini leading a Compact’s body passes', () => {
    document.body.innerHTML = row(
      'Bonesaw',
      `<div class="su-entity-linked" data-entity-linked="">${token('Mazona')}</div>`
    )
    expect(scan()).toEqual([])
  })

  test('a TitledBox wears the frame class but is no Compact', () => {
    document.body.innerHTML = `<section class="su-entity-compact su-box">${row('When Damaged', `<div>${token('Mazona')}</div>`)}</section>`
    expect(scan()).toEqual([])
  })
})
