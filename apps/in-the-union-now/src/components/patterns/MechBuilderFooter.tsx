import { Eye, EyeOff, Save, Trash2, Copy, Crosshair, AlertTriangle } from 'lucide-react'
import { Button } from '../ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/tooltip'
import { SheetFooter } from '../shared/SheetFooter'
import { actionButtonClasses } from '../shared/actionButtonClasses'
import type { SaveStatus } from '../../hooks/useSaveStatus'
import type { MechSourcePattern } from '../../lib/mechUtils'

type MechBuilderFooterProps = {
  hideFooterToggles?: boolean
  visible: boolean
  startingMechMode: boolean
  canSave: boolean
  saveStatus?: SaveStatus
  isSaving?: boolean
  isDeleting?: boolean
  isCopying?: boolean
  isSavingToPatterns?: boolean
  isDeviated?: boolean
  sourcePattern?: MechSourcePattern | null
  onToggleVisible: () => void
  onToggleStartingMech: () => void
  onSave?: () => void
  onCancel?: () => void
  onDelete?: () => void
  onCopy?: () => void
  onSaveToPatterns?: () => void
  onViewPattern?: () => void
}

export function MechBuilderFooter({
  hideFooterToggles,
  visible,
  startingMechMode,
  canSave,
  saveStatus,
  isSaving,
  isDeleting,
  isCopying,
  isSavingToPatterns,
  isDeviated,
  sourcePattern,
  onToggleVisible,
  onToggleStartingMech,
  onSave,
  onCancel,
  onDelete,
  onCopy,
  onSaveToPatterns,
  onViewPattern,
}: MechBuilderFooterProps) {
  return (
    <SheetFooter
      saveStatusText={saveStatus?.statusText}
      leftContent={
        !hideFooterToggles ? (
          <>
            <button
              type="button"
              onClick={onToggleVisible}
              className={`flex cursor-pointer items-center gap-1.5 text-xs transition-colors hover:text-su-white ${visible ? 'text-su-white' : 'text-su-white/70'}`}
              title={visible ? 'Pattern is visible' : 'Pattern is hidden'}
            >
              {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              <span>{visible ? 'Visible' : 'Hidden'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleStartingMech}
              className={`flex cursor-pointer items-center gap-1.5 text-xs transition-colors hover:text-su-white ${startingMechMode ? 'text-su-white' : 'text-su-white/70'}`}
              title={startingMechMode ? 'Starting mech mode on' : 'Starting mech mode off'}
            >
              <Crosshair className="h-4 w-4" />
              <span>Starting Mech</span>
            </button>
          </>
        ) : undefined
      }
      rightContent={
        <>
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className={actionButtonClasses('rust')}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          ) : onCancel ? (
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          ) : null}
          {onCopy && (
            <button
              type="button"
              onClick={onCopy}
              disabled={isCopying}
              className={actionButtonClasses('green')}
            >
              <Copy className="h-3.5 w-3.5" />
              {isCopying ? 'Copying...' : 'Copy'}
            </button>
          )}
          {sourcePattern && onViewPattern ? (
            <TooltipProvider>
              <div className="flex items-center gap-1.5">
                {isDeviated && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center text-su-orange">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Loadout has changed since this pattern was applied
                    </TooltipContent>
                  </Tooltip>
                )}
                <button
                  type="button"
                  onClick={onViewPattern}
                  className={actionButtonClasses('green')}
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Pattern
                </button>
              </div>
            </TooltipProvider>
          ) : onSaveToPatterns ? (
            <button
              type="button"
              onClick={onSaveToPatterns}
              disabled={isSavingToPatterns}
              className={actionButtonClasses('green')}
            >
              <Save className="h-3.5 w-3.5" />
              {isSavingToPatterns ? 'Saving...' : 'Save to My Patterns'}
            </button>
          ) : null}
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave || isSaving}
              className={actionButtonClasses('orange')}
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          )}
        </>
      }
    />
  )
}
