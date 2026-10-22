/**
 * RunEncounterDialog — "Run an encounter" from the Opposition (play.md §10,
 * ADR-053): one of the Mediator's shelf encounters, and what becomes of the
 * Opposition already on the tray. Running copies the encounter in, so the
 * saved one stays as it was built.
 *
 * Adding is the default. Clearing the tray first removes every NPC on it, so
 * the choice says how many, and is the Mediator's own (ADR-007): Run is the
 * act that does it.
 */

import type { Encounter } from 'game-domain/schemas/encounter'
import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import { capsLabel } from '../../components/atoms/capsLabel'
import { ConfirmDialog, Radio, Stack, toast, tokens } from '../../components/index'
import { AppLink } from '../../components/shared/AppLink'
import { encounterLine, trayChoiceLabel } from './runEncounter.model'

const FIELDSET = {
  border: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  margin: 0,
  minWidth: 0,
  padding: 0,
} satisfies CSSProperties

const LEGEND = { marginBottom: tokens.space[8], padding: 0 } satisfies CSSProperties
const LEGEND_CAPS = capsLabel({ size: 'badge' })

type RunEncounterDialogProps = {
  open: boolean
  onClose: () => void
  /** The Mediator's encounters. */
  encounters: readonly Encounter[]
  /** How many NPCs are on the tray now. */
  onTray: number
  onRun: (encounterId: string, clear: boolean) => Promise<{ added: number }>
}

export function RunEncounterDialog({
  open,
  onClose,
  encounters,
  onTray,
  onRun,
}: RunEncounterDialogProps) {
  const id = useId()
  const [chosen, setChosen] = useState<string | null>(null)
  const [clear, setClear] = useState(false)
  const picked = encounters.find((e) => e.id === chosen) ?? encounters[0] ?? null

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="Run an encounter"
      body={
        encounters.length === 0 ? (
          <>
            No encounters yet. Prep one in your <AppLink href="/">Training Bay</AppLink>: its
            opposition, the tables to hand and your notes.
          </>
        ) : (
          <Stack gap={16}>
            <span>
              From your Training Bay. Running one copies its opposition in at full HP, so the saved
              encounter stays as you built it.
            </span>
            <fieldset style={FIELDSET}>
              <legend className={LEGEND_CAPS} style={LEGEND}>
                Encounter
              </legend>
              {encounters.map((encounter) => (
                <Radio
                  key={encounter.id}
                  name={`${id}-encounter`}
                  value={encounter.id}
                  checked={picked?.id === encounter.id}
                  onChange={() => setChosen(encounter.id)}
                  label={encounter.name}
                  description={encounterLine(encounter)}
                />
              ))}
            </fieldset>
            {onTray > 0 && (
              <fieldset style={FIELDSET}>
                <legend className={LEGEND_CAPS} style={LEGEND}>
                  The Opposition on the tray
                </legend>
                <Radio
                  name={`${id}-tray`}
                  checked={!clear}
                  onChange={() => setClear(false)}
                  label="Add to it"
                />
                <Radio
                  name={`${id}-tray`}
                  checked={clear}
                  onChange={() => setClear(true)}
                  label={trayChoiceLabel(onTray)}
                />
              </fieldset>
            )}
          </Stack>
        )
      }
      confirmLabel={picked === null ? 'Close' : `Run ${picked.name}`}
      pendingLabel="Running…"
      tone={clear && onTray > 0 ? 'danger' : 'default'}
      onConfirm={async () => {
        if (picked === null) return
        const { added } = await onRun(picked.id, clear && onTray > 0)
        toast.success(`Running ${picked.name}: ${added} added to the Opposition.`)
        setClear(false)
      }}
    />
  )
}
