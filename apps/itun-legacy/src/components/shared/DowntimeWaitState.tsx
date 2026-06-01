import { Clock } from 'lucide-react'
import { Text } from 'suref-react'

type DowntimeWaitStateProps = {
  message: string
  orientationCopy?: string
}

export function DowntimeWaitState({ message, orientationCopy }: DowntimeWaitStateProps) {
  return (
    <div role="status" aria-label={message} className="flex flex-col items-center gap-2 py-6">
      <Clock className="h-6 w-6 text-su-white/40" />
      <Text variant="pseudoheader" as="span" className="text-sm text-su-white/60">
        {message}
      </Text>
      {orientationCopy && (
        <Text variant="default" as="p" className="max-w-xs text-center text-xs text-su-white/40">
          {orientationCopy}
        </Text>
      )}
    </div>
  )
}
