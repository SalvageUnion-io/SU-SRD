import { Eye, EyeOff, Save, Trash2, Copy, Crosshair, AlertTriangle } from 'lucide-react'
import { Button } from '../ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/tooltip'
import { SheetFooter } from '../shared/SheetFooter'
import { actionButtonClasses } from '../shared/actionButtonClasses'
import type { MechSourcePattern } from '../../lib/mechUtils'

type MechBuilderFooterProps = {
  hideFooterToggles?: boolean
  visible: boolean
  startingMechMode: boolean
  canSave: boolean
  compact?: boolean
  isDirty?: boolean
  saveStatusText?: string
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
  compact,
  isDirty,
  saveStatusText,
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
  const iconSize = compact ? 'h-3 w-3' : 'h-3.5 w-3.5'
  const toggleSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
  return (
    <SheetFooter
      compact={compact}
      saveStatusText={saveStatusText}
      leftContent={
        <>
          {!hideFooterToggles && (
            <>
              <button
                type="button"
                onClick={onToggleVisible}
                className={`flex cursor-pointer items-center gap-1 text-xs transition-colors hover:text-su-white ${visible ? 'text-su-white' : 'text-su-white/70'}`}
                title={visible ? 'Pattern is visible' : 'Pattern is hidden'}
              >
                {visible ? <Eye className={toggleSize} /> : <EyeOff className={toggleSize} />}
                <span>{visible ? 'Visible' : 'Hidden'}</span>
              </button>
              <button
                type="button"
                onClick={onToggleStartingMech}
                className={`flex cursor-pointer items-center gap-1 text-xs transition-colors hover:text-su-white ${startingMechMode ? 'text-su-white' : 'text-su-white/70'}`}
                title={startingMechMode ? 'Starting mech mode on' : 'Starting mech mode off'}
              >
                <Crosshair className={toggleSize} />
                <span>Starting Mech</span>
              </button>
            </>
          )}
          {!hideFooterToggles && (onDelete || onCopy) && (
            <div className="mx-1 h-4 w-px bg-su-white/30" />
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className={actionButtonClasses('rust', compact)}
            >
              <Trash2 className={iconSize} />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
          {onCopy && (
            <button
              type="button"
              onClick={onCopy}
              disabled={isCopying}
              className={actionButtonClasses('green', compact)}
            >
              <Copy className={iconSize} />
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
                        <AlertTriangle className={toggleSize} />
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
                  className={actionButtonClasses('green', compact)}
                >
                  <Eye className={iconSize} />
                  View Pattern
                </button>
              </div>
            </TooltipProvider>
          ) : onSaveToPatterns ? (
            <button
              type="button"
              onClick={onSaveToPatterns}
              disabled={isSavingToPatterns}
              className={actionButtonClasses('green', compact)}
            >
              <Save className={iconSize} />
              {isSavingToPatterns ? 'Saving...' : 'Save to My Patterns'}
            </button>
          ) : null}
        </>
      }
      rightContent={
        <>
          {onCancel && (
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          )}
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave || (isDirty !== undefined && !isDirty) || isSaving}
              className={actionButtonClasses('green', compact)}
            >
              <Save className={iconSize} />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          )}
        </>
      }
    />
  )
}
