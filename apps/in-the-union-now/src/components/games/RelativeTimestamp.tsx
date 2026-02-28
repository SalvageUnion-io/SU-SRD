import { useMemo } from 'react'
import { formatRelativeTime, formatAbsoluteTime } from '../../lib/timeFormatting'

type RelativeTimestampProps = {
  dateStr: string
  className?: string
}

export function RelativeTimestamp({ dateStr, className }: RelativeTimestampProps) {
  const date = useMemo(() => new Date(dateStr), [dateStr])

  const relativeText = useMemo(() => formatRelativeTime(date), [date])

  const absoluteText = useMemo(() => formatAbsoluteTime(date), [date])

  return (
    <time dateTime={dateStr} title={absoluteText} className={className}>
      {relativeText}
    </time>
  )
}
