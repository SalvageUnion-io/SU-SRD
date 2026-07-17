/**
 * SavePatternButton — captures a mech's configuration as a named reusable pattern.
 *
 * Renders as a Btn. On click, opens a ModalShell dialog where the user
 * enters a pattern name. On confirm, builds a MechPattern from the supplied
 * configuration and persists it via the patternStore (cross-tab broadcast +
 * backup nudge included — audit item 22).
 *
 * Design choice: the pattern name defaults to the mech name so the user can
 * confirm quickly. It is editable so patterns can have descriptive template names
 * independent of the specific mech instance.
 *
 * Error surface: save errors show an inline message in the dialog rather than a
 * toast so the user can retry without losing the dialog state.
 */

import { useState } from 'react'
import { Btn, Field, Input, ModalShell, toast } from 'component-lib'
import type { CargoLot } from '../../../lib/schemas/cargoLot'
import { cn } from '../../../lib/utils'
import { usePatternStore } from '../../../stores/patternStore'

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
      const pattern = await usePatternStore.getState().create({
        schemaVersion: 1,
        name: patternName.trim(),
        chassisRef,
        systems,
        modules,
        cargoLots,
      })
      setIsOpen(false)
      toast.success(`Saved pattern ${pattern.name}.`)
      onSaved?.(pattern.id)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save pattern.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Btn
        type="button"
        onClick={handleOpen}
        className={cn(className)}
        aria-label="Save as pattern"
      >
        Save as pattern
      </Btn>

      <ModalShell
        open={isOpen}
        onOpenChange={(next) => {
          if (!next) handleCancel()
        }}
        title="Save as pattern"
        headerBg="bg-su-orange"
        maxWidth="max-w-md"
        align="center"
      >
        <div className="flex flex-col gap-4 bg-paper p-5">
          <Field label="Pattern name" htmlFor="pattern-name-input">
            <Input
              id="pattern-name-input"
              type="text"
              aria-label="Pattern name"
              value={patternName}
              onChange={(e) => setPatternName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSave()
                // Escape is handled by the ModalShell dialog
              }}
            />
          </Field>

          {saveError && (
            <p className="font-body text-sm text-danger" role="alert">
              {saveError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Btn type="button" variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Btn>
            <Btn
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void handleSave()}
              disabled={isSaving || !patternName.trim()}
              aria-label="Save pattern"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </Btn>
          </div>
        </div>
      </ModalShell>
    </>
  )
}
