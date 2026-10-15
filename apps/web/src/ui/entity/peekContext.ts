import { useContext } from 'react'
import type { EntityRef } from 'salvageunion-reference'
import { InsidePeekContext } from '../components/atoms/insidePeek'
import type { Down } from '../components/referenceEntity/card/cardChrome'
import { conditionOf } from '../components/referenceEntity/card/cardChrome'

export { InsidePeekContext }

/** Whether the subtree is inside a Peek (`InsidePeekContext`). */
export function useInsidePeek(): boolean {
  return useContext(InsidePeekContext)
}

/**
 * The attribute a Peek TRIGGER carries: its entity's address. One host per page
 * (`PeekHost`) listens for it on the whole document, so a trigger costs one
 * attribute, renders the same on the server, and works in static HTML.
 */
export const PEEK_ATTRIBUTE = 'data-peek'

/** Set on a trigger whose entity is damaged (`damaged`) or destroyed
 * (`destroyed`): its Peek is down the same way. */
export const PEEK_DOWN_ATTRIBUTE = 'data-peek-down'

/** A ref's address as a trigger carries it: `schema:id`. */
function peekAddress(ref: EntityRef): string {
  return `${ref.schemaName}:${ref.id}`
}

/** The schema and id a trigger's address names, or `undefined` for a malformed one. */
export function parsePeekAddress(
  address: string | null | undefined
): { schemaName: string; id: string } | undefined {
  if (!address) return undefined
  const at = address.indexOf(':')
  if (at <= 0 || at === address.length - 1) return undefined
  return { schemaName: address.slice(0, at), id: address.slice(at + 1) }
}

/** A Peek trigger's attributes: its address and whether it is down, or nothing. */
export type PeekAttrs = {
  [PEEK_ATTRIBUTE]?: string
  [PEEK_DOWN_ATTRIBUTE]?: 'damaged' | 'destroyed'
}

/**
 * The address of a record EMBEDDED in another (a crawler bay's crew NPC): its
 * host's address and the part, `crawler-bays:<id>/npc`. It has no dataset row
 * of its own, so the Peek resolves it through its host (`PeekPopup`).
 */
export function embeddedPeekAddress(schemaName: string, hostId: string, part: 'npc'): string {
  return `${schemaName}:${hostId}/${part}`
}

/**
 * The attributes that make an element a Peek trigger, or none: a synthetic ref
 * (built from embedded data) has no dataset row to show unless its caller
 * names one (`address`, an `embeddedPeekAddress`), a pattern is drawn by its
 * own page, and inside a Peek nothing peeks again. A `down` trigger (damaged
 * or destroyed) says so, and its Peek is down the same way.
 */
export function usePeekAttrs(
  ref: EntityRef | undefined,
  address?: string,
  down: Down = false
): PeekAttrs {
  const inside = useInsidePeek()
  if (inside) return {}
  const at = address ?? (ref && !ref.synthetic && !ref.pattern ? peekAddress(ref) : undefined)
  if (!at) return {}
  const condition = conditionOf(down)
  return {
    [PEEK_ATTRIBUTE]: at,
    ...(condition ? { [PEEK_DOWN_ATTRIBUTE]: condition } : {}),
  }
}
