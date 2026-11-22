/**
 * "See rules for Bio-Chassis." in an entry's prose names a glossary entry in
 * plain words: at display it reads as that entry's Mention, so the sentence
 * opens the rules it points to (r5 C11). Only where the name resolves (a
 * trait, else a keyword, `mentionRef`); the book's text is never edited.
 */

import { mentionRef } from '../components/entity'

const SEE_RULES = /\b(See rules for )([A-Z][\w-]*(?: [A-Z][\w-]*)*)(?=\.)/g

/** The text with each resolving "See rules for X" marked as a `[[X]]` Mention. */
export function linkSeeRules(text: string): string {
  if (!text.includes('See rules for ')) return text
  return text.replace(SEE_RULES, (whole, lead: string, name: string) =>
    mentionRef(name) ? `${lead}[[${name}]]` : whole
  )
}
