import { cn } from '../../utils/cn'

type LevelDisplayProps = {
  level: number | string
  compact?: boolean
  inline?: boolean
}

export function LevelDisplay({ level, compact = false, inline = false }: LevelDisplayProps) {
  const size = compact ? 'h-5 w-5' : 'h-[25px] w-[25px]'
  const fontSize = compact ? 'text-lg' : 'text-2xl'

  if (inline) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-sm bg-black font-bold text-white',
          size,
          fontSize
        )}
      >
        {level}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'absolute -left-[15px] -top-0.5 z-10 flex items-center justify-center bg-black font-bold text-white opacity-100 pointer-events-none',
        size,
        fontSize
      )}
    >
      {level}
    </div>
  )
}
