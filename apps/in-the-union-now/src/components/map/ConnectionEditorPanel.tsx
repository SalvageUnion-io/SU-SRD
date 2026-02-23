import { useCallback, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import type { MapConnection } from './mapTypes'
import { CONNECTION_COLORS } from './mapConstants'

type ConnectionEditorPanelProps = {
  connection: MapConnection
  onUpdate: (connection: MapConnection) => void
  onDelete: (connectionId: string) => void
  onClose: () => void
}

export function ConnectionEditorPanel({
  connection,
  onUpdate,
  onDelete,
  onClose,
}: ConnectionEditorPanelProps) {
  const [label, setLabel] = useState(connection.label ?? '')

  const handleLabelBlur = useCallback(() => {
    const newLabel = label.trim() || undefined
    if (newLabel !== connection.label) {
      onUpdate({ ...connection, label: newLabel })
    }
  }, [label, connection, onUpdate])

  const handleColorChange = useCallback(
    (color: string) => {
      onUpdate({ ...connection, color })
    },
    [connection, onUpdate]
  )

  return (
    <div className="flex flex-col gap-3 rounded border border-su-grey-light/20 bg-su-grey-dark p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold uppercase text-su-white/70">
          Edit Connection
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
        placeholder="Connection label (optional)"
        className="h-8 border-su-grey-light/20 bg-su-dark text-sm text-su-white"
      />

      <div className="flex flex-wrap gap-1">
        {CONNECTION_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => handleColorChange(color)}
            className="h-6 w-6 rounded-sm border-2"
            style={{
              backgroundColor: color,
              borderColor: connection.color === color ? '#FFFFFF' : 'transparent',
            }}
            title={color}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(connection.id)}
          className="h-7 gap-1 text-xs text-su-rust hover:bg-su-rust/20"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </Button>
      </div>
    </div>
  )
}
