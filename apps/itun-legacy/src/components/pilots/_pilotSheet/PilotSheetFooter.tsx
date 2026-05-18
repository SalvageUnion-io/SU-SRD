import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { SheetFooter } from '../../shared/SheetFooter'
import { actionButtonClasses } from '../../shared/actionButtonClasses'
import type { PilotEditConfig } from '../../../hooks/usePilotSheet'
import type { PilotRow } from '../../../types/common'

type PilotSheetFooterProps = {
  pilot: PilotRow
  editConfig: PilotEditConfig
  onDeleteClick: () => void
}

export function PilotSheetFooter({ pilot, editConfig, onDeleteClick }: PilotSheetFooterProps) {
  return (
    <SheetFooter
      saveStatusText={editConfig.saveStatusText}
      leftContent={
        <button
          type="button"
          onClick={editConfig.onToggleVisibility}
          className={`flex cursor-pointer items-center gap-1.5 text-xs font-semibold transition-colors hover:text-su-white ${pilot.visible ? 'text-su-white' : 'text-su-white/70'}`}
          title={pilot.visible ? 'Pilot is visible' : 'Pilot is hidden'}
        >
          {pilot.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          <span>{pilot.visible ? 'Visible' : 'Hidden'}</span>
        </button>
      }
      rightContent={
        <button type="button" onClick={onDeleteClick} className={actionButtonClasses('rust')}>
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      }
    />
  )
}
