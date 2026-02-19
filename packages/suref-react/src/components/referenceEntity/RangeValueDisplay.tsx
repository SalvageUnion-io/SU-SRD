import { useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ValueDisplay } from '../shared/ValueDisplay'
import { Tooltip } from '../ui/tooltip'

type RangeValueDisplayProps = {
  label: string | number
  value?: string | number
  compact?: boolean
}

function getRangeDescription(rangeName: string): string | null {
  const distance = SalvageUnionReference.Distances.find(
    (d) => d.name.toLowerCase() === rangeName.toLowerCase()
  )
  if (!distance || !('content' in distance) || !Array.isArray(distance.content)) return null
  const paragraphs = (distance.content as { type: string; value: string }[]).filter(
    (block) => block.type === 'paragraph'
  )
  return paragraphs.map((block) => block.value).join(' ') || null
}

export function RangeValueDisplay({ label, value, compact = false }: RangeValueDisplayProps) {
  const description = useMemo(() => (value ? getRangeDescription(String(value)) : null), [value])

  const display = <ValueDisplay label={label} value={value} compact={compact} inline={false} />

  if (!description) return display

  return (
    <Tooltip content={description} delayDuration={200}>
      <span style={{ cursor: 'help' }}>{display}</span>
    </Tooltip>
  )
}
