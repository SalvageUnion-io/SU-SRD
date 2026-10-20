import type { Page } from '@playwright/test'

/**
 * Hard rule R5, a linked unit is a relation chip (`chips-and-actions.md` C11),
 * as the rendered page draws it: what a Compact is linked to rides its chip group
 * as a relation chip, so no entity hangs under a Compact.
 *
 * - `nested` — an entity (a Compact or a Mini) inside a Compact's frame but outside
 *   its head: a Compact's body holds a lead or a stamp, never an entity (E3).
 * - `under` — a Mini straight after a Compact, the next thing in the Compact's own
 *   container (a wrapper with nothing else in it counts as the Compact): a linked
 *   unit hung under the Compact it belongs to, where its relation chip should be.
 *
 * A Card's head is no Compact (`.su-ec-frame`): its body nests its actions and
 * children as Minis (E6). Subtrees hidden from assistive tech are not read.
 */
export type RelationFinding = { rule: 'nested' | 'under'; detail: string }

export const RELATION_SELECTORS = {
  row: '.su-entity-compact__frame',
  head: '.su-entity-compact__head',
  title: '.su-entity-compact__title',
  card: '.su-ec-frame',
  box: '.su-box',
  entity: '.su-entity-compact__frame, .su-entity-mini',
  token: '.su-entity-mini',
  tokenName: '.su-entity-mini__name',
}

export function scanRelations(a: typeof RELATION_SELECTORS): RelationFinding[] {
  const found: RelationFinding[] = []
  const text = (el: Element | null | undefined) =>
    (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
  const hidden = (el: Element) => el.closest('[aria-hidden="true"], [inert]') !== null
  for (const row of document.querySelectorAll(a.row)) {
    // A `Box` (a TitledBox) wears the Compact's frame class; it is no Compact.
    if (hidden(row) || row.matches(a.card) || row.parentElement?.matches(a.box)) continue
    const name = text(row.querySelector(a.title)) || 'a Compact'
    const head = row.querySelector(a.head)
    for (const inner of row.querySelectorAll(a.entity)) {
      if (head?.contains(inner) || hidden(inner)) continue
      found.push({ rule: 'nested', detail: `“${name}” holds an entity in its body` })
      break
    }
    // The Compact as its container sees it: up through wrappers that hold nothing else.
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
      const tokenName = text(token.querySelector(a.tokenName)) || 'a Mini'
      found.push({ rule: 'under', detail: `“${tokenName}” hangs under “${name}”` })
    }
  }
  return found
}

export async function findRelationFindings(page: Page): Promise<RelationFinding[]> {
  return page.evaluate(scanRelations, RELATION_SELECTORS)
}
