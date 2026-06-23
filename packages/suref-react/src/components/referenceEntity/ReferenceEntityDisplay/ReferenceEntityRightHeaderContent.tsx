import type { SURefEntity } from 'salvageunion-reference'
import { isAbility } from 'salvageunion-reference'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { cn } from '../../../utils/cn'
import type { getReferenceEntityFontSizes } from './referenceEntityDisplayTypes'

type ReferenceEntityRightHeaderContentProps = {
  data: SURefEntity
  fontSize: ReturnType<typeof getReferenceEntityFontSizes>
  /** Accent text colour — a lighter variant of the card's base/header colour.
   *  Falls back to white when not provided. */
  accentColor?: string
  /**
   * Flavor string for non-ability entities, hoisted out of the body `content`
   * array (the first `type: 'flavor'` block) by the orchestrator so it renders
   * in the header-right slot instead of the body. Abilities ignore this and use
   * their top-level `description` field as before.
   */
  flavor?: string
}

export function ReferenceEntityRightHeaderContent({
  data,
  fontSize,
  accentColor,
  flavor,
}: ReferenceEntityRightHeaderContentProps) {
  // Abilities surface their top-level `description`; all other entities surface
  // the hoisted `flavor` content block passed down by the orchestrator.
  const description = isAbility(data)
    ? 'description' in data
      ? data.description
      : undefined
    : flavor
  const parsedDescription = useParseTraitReferences(description)

  if (!description) return null

  return (
    <div
      className={cn(
        // Flavor text: a lighter variant of the base/header colour (no backing
        // chip, no drop shadow). Falls back to white when no accent is available.
        'pr-1.5 text-pretty text-right font-cond font-semibold leading-none',
        !accentColor && 'text-su-white',
        fontSize.sm
      )}
      style={accentColor ? { color: accentColor } : undefined}
    >
      {parsedDescription}
    </div>
  )
}
