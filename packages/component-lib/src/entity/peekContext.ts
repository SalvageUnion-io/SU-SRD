import { createContext, useContext } from 'react'
import type { EntityRef } from 'salvageunion-reference'

/**
 * Whether the subtree is INSIDE a Peek. A Peek is read-only and terminal (E16):
 * no links, no modes, no Peek inside it, and no tooltip primitive arming a
 * popup of its own. The Peek provides it; every form, part and tooltip reads it.
 */
export const InsidePeekContext = createContext(false)

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

/** A Peek trigger's attributes: its address, or nothing. */
export type PeekAttrs = { [PEEK_ATTRIBUTE]?: string }

/**
 * The attributes that make an element a Peek trigger, or none: a synthetic ref
 * (built from embedded data) has no dataset row to show, a pattern is drawn by
 * its own page, and inside a Peek nothing peeks again.
 */
export function usePeekAttrs(ref: EntityRef | undefined): PeekAttrs {
  const inside = useInsidePeek()
  if (!ref || inside || ref.synthetic || ref.pattern) return {}
  return { [PEEK_ATTRIBUTE]: peekAddress(ref) }
}
