import type { ReactNode } from 'react'

/** A Ledger cell with nothing to say draws `—` (L5); a `0` is a value. */
export const isEmpty = (cell: ReactNode) =>
  cell === '' || cell === null || cell === undefined || cell === false

/** `[[Trait]]` markup in rules text (the dataset's own). */
export const MARKUP = /\[\[([^\]]+)\]\]/g

/**
 * A cell's words; rules text's `[[Trait]]` reads as its word, never as markup.
 * A quiet line, cut to its one line, holds no links but its names' Peeks (an
 * index's abilities and traits, `IndexLedger`); a Page's loadout line links
 * its parts (L4).
 */
export function cellBody(cell: ReactNode): ReactNode {
  return typeof cell === 'string' ? cell.replace(MARKUP, '$1') : cell
}
