import type { SURefEntity } from 'salvageunion-reference'
import { getGoals, getAssets, getWeaknesses } from 'salvageunion-reference'
import { cn } from '../../../../utils/cn'
import type { getReferenceEntityFontSizes } from '../referenceEntityDisplayTypes'
import { useDisplayFontSize } from '../displayStateContext'

type ReferenceEntityFactionDataProps = {
  data: SURefEntity
  compact: boolean
  /** Optional override; falls back to the card display-state context. */
  fontSize?: ReturnType<typeof getReferenceEntityFontSizes>
  borderColor: string | undefined
}

const FACTION_FIELDS = [
  { label: 'Goals', getter: getGoals },
  { label: 'Assets', getter: getAssets },
  { label: 'Weaknesses', getter: getWeaknesses },
] as const

export function ReferenceEntityFactionData({
  data,
  compact,
  fontSize: fontSizeProp,
  borderColor,
}: ReferenceEntityFactionDataProps) {
  const fontSize = useDisplayFontSize(fontSizeProp, compact)
  const entries = FACTION_FIELDS.map(({ label, getter }) => ({
    label,
    value: getter(data),
  })).filter(({ value }) => !!value)

  if (entries.length === 0) return null

  return (
    <>
      {entries.map(({ label, value }) => (
        <div key={label} className="mt-2">
          <h5
            className={cn(
              'font-cond inline self-start box-decoration-clone bg-su-black text-su-white px-1 font-bold uppercase leading-none tracking-tight mb-1',
              fontSize.sm
            )}
            style={{ lineHeight: 1 }}
          >
            {label}
          </h5>
          <div
            className={compact ? 'pl-2' : 'pl-3'}
            style={borderColor ? { borderLeft: `3px solid ${borderColor}` } : undefined}
          >
            <div
              className={cn(
                'mb-2 break-words font-medium leading-snug whitespace-normal text-su-black',
                fontSize.sm
              )}
              style={{ overflowWrap: 'break-word' }}
            >
              {value}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
