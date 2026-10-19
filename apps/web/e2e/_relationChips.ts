import type { Page } from '@playwright/test'

/**
 * Hard rule R5, a linked unit is a relation chip (`chips-and-actions.md` C11),
 * as the rendered page draws it: what a Row is linked to rides its chip group
 * as a relation chip, so no entity hangs under a Row.
 *
 * - `nested` — an entity (a Row or a Token) inside a Row's frame but outside
 *   its head: a Row's body holds a lead or a stamp, never an entity (E3).
 * - `under` — a Token straight after a Row, the next thing in the Row's own
 *   container (a wrapper with nothing else in it counts as the Row): a linked
 *   unit hung under the Row it belongs to, where its relation chip should be.
 *
 * A Card's head is no Row (`.su-ec-frame`): its body nests its actions and
 * children as Tokens (E6). Subtrees hidden from assistive tech are not read.
 */
export type RelationFinding = { rule: 'nested' | 'under'; detail: string }

export const RELATION_SELECTORS = {
  row: '.su-entity-row__frame',
  head: '.su-entity-row__head',
  title: '.su-entity-row__title',
  card: '.su-ec-frame',
  box: '.su-box',
  entity: '.su-entity-row__frame, .su-entity-token',
  token: '.su-entity-token',
  tokenName: '.su-entity-token__name',
}

export function scanRelations(a: typeof RELATION_SELECTORS): RelationFinding[] {
  const found: RelationFinding[] = []
  const text = (el: Element | null | undefined) =>
    (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
  const hidden = (el: Element) => el.closest('[aria-hidden="true"], [inert]') !== null
  for (const row of document.querySelectorAll(a.row)) {
    // A `Box` (a TitledBox) wears the Row's frame class; it is no Row.
    if (hidden(row) || row.matches(a.card) || row.parentElement?.matches(a.box)) continue
    const name = text(row.querySelector(a.title)) || 'a Row'
    const head = row.querySelector(a.head)
    for (const inner of row.querySelectorAll(a.entity)) {
      if (head?.contains(inner) || hidden(inner)) continue
      found.push({ rule: 'nested', detail: `“${name}” holds an entity in its body` })
      break
    }
    // The Row as its container sees it: up through wrappers that hold nothing else.
    let unit: Element = row
    while (unit.parentElement && unit.parentElement.childElementCount === 1) {
      if (unit.parentElement.matches('ul, ol, main, section')) break
      unit = unit.parentElement
    }
    const next = unit.nextElementSibling
    if (!next || hidden(next)) continue
    const token = next.matches(a.token)
      ? next
      : next.firstElementChild?.matches(a.token)
        ? next.firstElementChild
        : null
    if (token && !next.matches(a.row) && !next.querySelector(a.row)) {
      const tokenName = text(token.querySelector(a.tokenName)) || 'a Token'
      found.push({ rule: 'under', detail: `“${tokenName}” hangs under “${name}”` })
    }
  }
  return found
}

export async function findRelationFindings(page: Page): Promise<RelationFinding[]> {
  return page.evaluate(scanRelations, RELATION_SELECTORS)
}
