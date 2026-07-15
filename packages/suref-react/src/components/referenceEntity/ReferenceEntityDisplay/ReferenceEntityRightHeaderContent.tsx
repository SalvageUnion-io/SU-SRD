import type { SURefEntity } from 'salvageunion-reference'
import { isAbility } from 'salvageunion-reference'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { cn } from '../../../utils/cn'
import type { getReferenceEntityFontSizes } from './referenceEntityDisplayTypes'
import { useDisplayFontSize } from './displayStateContext'

type ReferenceEntityRightHeaderContentProps = {
  data: SURefEntity
  /** Optional override; falls back to the card display-state context. */
  fontSize?: ReturnType<typeof getReferenceEntityFontSizes>
  /** Accent text colour — a lighter variant of the card's base/header colour.
   *  Falls back to white when not provided. */
  accentColor?: string
}

export function ReferenceEntityRightHeaderContent({
  data,
  fontSize: fontSizeProp,
  accentColor,
}: ReferenceEntityRightHeaderContentProps) {
  const fontSize = useDisplayFontSize(fontSizeProp, false)
  const description = 'description' in data ? data.description : undefined
  const parsedDescription = useParseTraitReferences(description)

  if (!description || !isAbility(data)) return null

  return (
    <div
      className={cn(
        // Flavor text: a lighter variant of the base/header colour (no backing
        // chip, no drop shadow). Falls back to white when no accent is available.
        'pr-1.5 text-pretty text-right font-cond font-semibold leading-none',
        !accentColor && 'text-paper',
        fontSize.sm
      )}
      style={accentColor ? { color: accentColor } : undefined}
    >
      {parsedDescription}
    </div>
  )
}
