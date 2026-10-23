import { useParseTraitReferences } from '../lib/useProseRefs'

/**
 * Prose whose trait and entity names are resolved as it renders
 * (`useParseTraitReferences`), each a `Mention`: a roll table's result, a
 * guide's note, a pattern's description, a Mini's lead, a bay's When Damaged.
 * A component, not the hook, so a list draws one per row (a hook cannot run in
 * a map). Bare it adds no element; `as="p"` sets it in a paragraph.
 * `MentionProse` is its build-time twin, for refs resolved ahead.
 */
export function TraitProse({
  text,
  as,
  className,
}: {
  text: string
  /** The paragraph it is, when it is one. */
  as?: 'p'
  /** For `as="p"`: the paragraph's class. */
  className?: string
}) {
  const prose = useParseTraitReferences(text)
  if (as === 'p') return <p className={className}>{prose}</p>
  return <>{prose}</>
}
