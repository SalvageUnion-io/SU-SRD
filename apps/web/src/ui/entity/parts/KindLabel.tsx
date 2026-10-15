/**
 * KIND LABEL — what kind of entity this is ("System", "Ability, Advanced
 * Hacking Tree"), for screen readers only. No form stamps the kind beside a
 * title (E9): the band, its chips and the page already say it to the eye. Set
 * inside the title, it ends the title's accessible name and its heading.
 */
export function KindLabel({ kind }: { kind: string | undefined }) {
  if (!kind) return null
  return <span className="su-sr-only"> ({kind.replaceAll(' · ', ', ')})</span>
}
