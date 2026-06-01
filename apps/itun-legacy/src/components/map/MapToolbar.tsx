import { MousePointer2, Square, Circle, Minus, Move, Image } from 'lucide-react'
import { Button } from '../ui/button'
import type { EditMode } from './mapTypes'

type MapToolbarProps = {
  editMode: EditMode
  onModeChange: (mode: EditMode) => void
  onBackgroundClick: () => void
}

const TOOLS: { mode: EditMode; icon: React.ReactNode; label: string }[] = [
  { mode: 'select', icon: <MousePointer2 className="h-4 w-4" />, label: 'Select' },
  { mode: 'draw-rect', icon: <Square className="h-4 w-4" />, label: 'Rectangle' },
  { mode: 'draw-ellipse', icon: <Circle className="h-4 w-4" />, label: 'Ellipse' },
  { mode: 'draw-line', icon: <Minus className="h-4 w-4" />, label: 'Connect' },
  { mode: 'pan', icon: <Move className="h-4 w-4" />, label: 'Pan' },
]

export function MapToolbar({ editMode, onModeChange, onBackgroundClick }: MapToolbarProps) {
  return (
    <div className="flex items-center gap-1 rounded border border-su-grey-light/20 bg-su-grey-dark/80 px-2 py-1">
      {TOOLS.map(({ mode, icon, label }) => (
        <Button
          key={mode}
          variant="ghost"
          size="sm"
          onClick={() => onModeChange(mode)}
          className={`h-8 w-8 p-0 ${
            editMode === mode
              ? 'bg-su-pink/30 text-su-pink'
              : 'text-su-white/60 hover:text-su-white'
          }`}
          title={label}
        >
          {icon}
        </Button>
      ))}
      <div className="mx-1 h-5 w-px bg-su-grey-light/20" />
      <Button
        variant="ghost"
        size="sm"
        onClick={onBackgroundClick}
        className="h-8 w-8 p-0 text-su-white/60 hover:text-su-white"
        title="Set background image"
      >
        <Image className="h-4 w-4" />
      </Button>
    </div>
  )
}
