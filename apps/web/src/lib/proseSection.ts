import { createContext } from 'react'

/**
 * A section of prose: within it a term links once, at its first mention, and
 * reads as plain words after (a guide's step linked "Mech" in every
 * paragraph, RR2-15). A book's page reference always links: it cites.
 *
 * Each run of prose claims a term under its own id, so a claim holds across
 * re-renders: the run that linked a term first keeps the link. The scope is
 * `ProseSection`'s; `useParseTraitReferences` reads it.
 */
export type ProseSectionScope = { claim: (term: string, by: string) => boolean }

export const ProseSectionContext = createContext<ProseSectionScope | undefined>(undefined)
