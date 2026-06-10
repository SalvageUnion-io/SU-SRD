/**
 * SavePatternButton — captures a mech's configuration as a named reusable pattern.
 *
 * Renders as an outline Button. On click, opens an inline dialog where the user
 * enters a pattern name. On confirm, builds a MechPattern from the supplied
 * configuration and persists it via db.mechPatterns.create().
 *
 * Design choice: the pattern name defaults to the mech name so the user can
 * confirm quickly. It is editable so patterns can have descriptive template names
 * independent of the specific mech instance.
 *
 * Error surface: save errors show an inline message in the dialog rather than a
 * toast so the user can retry without losing the dialog state.
 */

import { useRef, useState } from 'react'
import * as db from '../../../lib/db/index'
import type { CargoLot } from '../../../lib/schemas/cargoLot'
import { useDialogA11y } from '../../shared/useDialogA11y'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'

type SavePatternButtonProps = {
  /** Name of the source mech — pre-fills the pattern name field. */
  mechName: string
  chassisRef: string
  systems: string[]
  modules: string[]
  cargoLots: CargoLot[]
  /** Called after the pattern is successfully saved. */
  onSaved?: (patternId: string) => void
  className?: string
}

export function SavePatternButton({
  mechName,
  chassisRef,
  systems,
  modules,
  cargoLots,
  onSaved,
  className,
}: SavePatternButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [patternName, setPatternName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function handleOpen() {
    setPatternName(mechName)
    setSaveError(null)
    setIsOpen(true)
  }

  function handleCancel() {
    setIsOpen(false)
    setSaveError(null)
  }

  async function handleSave() {
    if (!patternName.trim()) {
      setSaveError('Pattern name is required.')
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const pattern = await db.mechPatterns.create({
        schemaVersion: 1,
        name: patternName.trim(),
        chassisRef,
        systems,
        modules,
        cargoLots,
      })
      setIsOpen(false)
      onSaved?.(pattern.id)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save pattern.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleOpen}
        className={cn(className)}
        aria-label="Save as pattern"
      >
        Save as pattern
      </Button>

      {isOpen && (
        <SavePatternDialog
          patternName={patternName}
          setPatternName={setPatternName}
          saveError={saveError}
          isSaving={isSaving}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Dialog sub-component (mounted only when open, so useDialogA11y runs once)
// ---------------------------------------------------------------------------

type SavePatternDialogProps = {
  patternName: string
  setPatternName: (name: string) => void
  saveError: string | null
  isSaving: boolean
  onSave: () => Promise<void>
  onCancel: () => void
}

function SavePatternDialog({
  patternName,
  setPatternName,
  saveError,
  isSaving,
  onSave,
  onCancel,
}: SavePatternDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogA11y({ ref: dialogRef, onClose: onCancel })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-pattern-dialog-title"
        className="rounded-lg border border-border bg-background p-6 shadow-lg w-full max-w-sm mx-4 flex flex-col gap-4"
      >
        <h2 id="save-pattern-dialog-title" className="text-lg font-semibold">
          Save as pattern
        </h2>

        <div className="flex flex-col gap-1">
          <label htmlFor="pattern-name-input" className="text-sm font-medium">
            Pattern name
          </label>
          <input
            id="pattern-name-input"
            type="text"
            aria-label="Pattern name"
            value={patternName}
            onChange={(e) => setPatternName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onSave()
              // Escape is handled globally by useDialogA11y
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {saveError && (
          <p className="text-sm text-destructive" role="alert">
            {saveError}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={isSaving || !patternName.trim()}
            aria-label="Save pattern"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
