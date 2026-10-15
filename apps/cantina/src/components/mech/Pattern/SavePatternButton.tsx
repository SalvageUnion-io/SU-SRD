/**
 * SavePatternButton — captures a mech's configuration as a named reusable pattern.
 *
 * Renders as a Button. On click, opens a ModalShell dialog where the user
 * enters a pattern name. On confirm, builds a MechPattern from the supplied
 * configuration and persists it via the patternStore.
 *
 * Design choice: the pattern name defaults to the mech name so the user can
 * confirm quickly. It is editable so patterns can have descriptive template names
 * independent of the specific mech instance.
 *
 * Error surface: save errors show an inline message in the dialog rather than a
 * toast so the user can retry without losing the dialog state.
 */

import type { CargoLot } from 'cantina-domain/schemas/cargoLot'
import { Button, Field, FieldError, Input, ModalShell, toast } from 'component-lib'
import { useState } from 'react'
import { useServerAction } from '../../../lib/connection/useServerAction'
import { usePatternStore } from '../../../stores/patternStore'
import '../../../styles/wizard.css'
import { dialogActionsStyle, dialogBodyStyle } from '../../wizard/wizardStyles.model'

type SavePatternButtonProps = {
  /** Name of the source mech — pre-fills the pattern name field. */
  mechName: string
  chassisRef: string
  systems: string[]
  modules: string[]
  cargoLots: CargoLot[]
  /** Called after the pattern is successfully saved. */
  onSaved?: (patternId: string) => void
}

export function SavePatternButton({
  mechName,
  chassisRef,
  systems,
  modules,
  cargoLots,
  onSaved,
}: SavePatternButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [patternName, setPatternName] = useState('')
  // The form's own complaint; a failed save is `save.error`.
  const [invalid, setInvalid] = useState<string | null>(null)
  const save = useServerAction(
    (name: string) =>
      usePatternStore
        .getState()
        .create({ schemaVersion: 1, name, chassisRef, systems, modules, cargoLots }),
    { failure: 'The pattern could not be saved. Try again.' }
  )
  const isSaving = save.pending
  const saveError = invalid ?? save.error

  function handleOpen() {
    setPatternName(mechName)
    setInvalid(null)
    save.clearError()
    setIsOpen(true)
  }

  function handleCancel() {
    setIsOpen(false)
    setInvalid(null)
    save.clearError()
  }

  async function handleSave() {
    if (!patternName.trim()) {
      setInvalid('Pattern name is required.')
      return
    }
    setInvalid(null)

    const result = await save.run(patternName.trim())
    if (!result.ok) return
    setIsOpen(false)
    toast.success(`Saved pattern ${result.value.name}.`)
    onSaved?.(result.value.id)
  }

  return (
    <>
      <Button type="button" onClick={handleOpen} aria-label="Save as pattern">
        Save as pattern
      </Button>

      <ModalShell
        open={isOpen}
        onOpenChange={(next) => {
          if (!next) handleCancel()
        }}
        title="Save as pattern"
        maxWidth="su-wiz-modal-md"
      >
        <div style={dialogBodyStyle}>
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

          {saveError && <FieldError>{saveError}</FieldError>}

          <div style={dialogActionsStyle}>
            <Button
              type="button"
              variant="ghost"
              size="compact"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="compact"
              onClick={() => void handleSave()}
              disabled={isSaving || !patternName.trim()}
              aria-label="Save pattern"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </ModalShell>
    </>
  )
}
