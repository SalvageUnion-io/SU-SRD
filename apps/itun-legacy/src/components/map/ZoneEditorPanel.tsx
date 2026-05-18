import { useCallback, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import type { MapZone } from './mapTypes'
import { ZONE_COLORS } from './mapConstants'

type ZoneEditorPanelProps = {
  zone: MapZone
  onUpdate: (zone: MapZone) => void
  onDelete: (zoneId: string) => void
  onClose: () => void
  canDrillDown: boolean
  onDrillDown: () => void
}

export function ZoneEditorPanel({
  zone,
  onUpdate,
  onDelete,
  onClose,
  canDrillDown,
  onDrillDown,
}: ZoneEditorPanelProps) {
  const [label, setLabel] = useState(zone.label)

  const handleLabelBlur = useCallback(() => {
    if (label !== zone.label) {
      onUpdate({ ...zone, label })
    }
  }, [label, zone, onUpdate])

  const handleColorChange = useCallback(
    (color: string) => {
      onUpdate({ ...zone, color })
    },
    [zone, onUpdate]
  )

  const handleShapeToggle = useCallback(() => {
    const nextShape = zone.shape === 'rect' ? 'ellipse' : 'rect'
    onUpdate({ ...zone, shape: nextShape })
  }, [zone, onUpdate])

  return (
    <div className="flex flex-col gap-3 rounded border border-su-grey-light/20 bg-su-grey-dark p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold uppercase text-su-white/70">
          Edit Zone
        </span>
        <button type="button" onClick={onClose} className="text-su-white/40 hover:text-su-white">
          &times;
        </button>
      </div>

      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={handleLabelBlur}
        onKeyDown={(e) => e.key === 'Enter' && handleLabelBlur()}
        placeholder="Zone label"
        className="h-8 border-su-grey-light/20 bg-su-dark text-sm text-su-white"
      />

      <div className="flex flex-wrap gap-1">
        {ZONE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => handleColorChange(color)}
            className="h-6 w-6 rounded-sm border-2"
            style={{
              backgroundColor: color,
              borderColor: zone.color === color ? '#FFFFFF' : 'transparent',
            }}
            title={color}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShapeToggle}
          className="h-7 text-xs text-su-white/70 hover:text-su-white"
        >
          Shape: {zone.shape === 'rect' ? 'Rectangle' : 'Ellipse'}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        {canDrillDown && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDrillDown}
            className="h-7 text-xs text-su-pink hover:bg-su-pink/20"
          >
            Open Sub-Map &gt;
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(zone.id)}
          className="h-7 gap-1 text-xs text-su-rust hover:bg-su-rust/20"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </Button>
      </div>
    </div>
  )
}
