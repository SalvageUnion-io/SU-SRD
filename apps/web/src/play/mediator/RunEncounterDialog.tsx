/**
 * RunEncounterDialog — "Run an encounter" from the Opposition (play.md §10,
 * ADR-059): one of the Mediator's shelf encounters, and what becomes of the
 * Opposition already on the tray. Running copies the encounter in, so the
 * saved one stays as it was built.
 *
 * Adding is the default. Clearing the tray first removes every NPC on it, so
 * the choice says how many, and is the Mediator's own (ADR-007): Run is the
 * act that does it. With no group session live, running one starts it, and
 * the dialog says so in a ticked line a test run can clear (r7 C6). It
 * starts on the first encounter not yet run at this table (r8 B8).
 */

import type { Encounter } from 'game-domain/schemas/encounter'
import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import { ConfirmDialog, Radio } from '../../components/app'
import { Checkbox, capsLabel, InlineRef, Stack, toast, tokens } from '../../components/index'
import { mediatorCopy } from '../../messages/play-mediator'
import { useGamesQuery } from '../../replica/roomCalls'
import { useTableRead } from '../../replica/useTable'
import { KIT_PATH } from '../games/prep/gamePrep.model'
import { choiceLine, runChoices, trayChoiceLabel } from './runEncounter.model'

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
  /** The Game at this table: its encounters lead, and another Game's is named. */
  gameId: string
  /** How many NPCs are on the tray now. */
  onTray: number
  /** A group session is live: running one starts none, so the dialog asks nothing of it. */
  sessionLive: boolean
  onRun: (encounterId: string, clear: boolean, startSession: boolean) => Promise<{ added: number }>
}

export function RunEncounterDialog({
  open,
  onClose,
  encounters: mine,
  gameId,
  onTray,
  sessionLive,
  onRun,
}: RunEncounterDialogProps) {
  const id = useId()
  const [chosen, setChosen] = useState<string | null>(null)
  const [clear, setClear] = useState(false)
  // Running starts the group session, said and ticked, so a test run can say no (r7 C6).
  const [startSession, setStartSession] = useState(true)
  const games = useGamesQuery('games.listMine', open ? {} : 'skip')
  const choices = runChoices(
    mine,
    gameId,
    (other) => games?.find((g) => g._id === other)?.name ?? null
  )
  const encounters = choices.map((c) => c.encounter)
  // The first not yet run at this table leads (r8 B8, MD8-09): last week's fight is never preselected.
  const ran = new Set(useTableRead('mediator.ran', open ? { gameId } : 'skip') ?? [])
  const picked =
    encounters.find((e) => e.id === chosen) ??
    encounters.find((e) => !ran.has(e.id)) ??
    encounters[0] ??
    null

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={mediatorCopy('runAnEncounter')}
      body={
        encounters.length === 0 ? (
          <>
            {mediatorCopy('noEncountersYet')}{' '}
            <InlineRef href={KIT_PATH}>{mediatorCopy('trainingBay')}</InlineRef>
            {mediatorCopy('noEncountersTail')}
          </>
        ) : (
          <Stack gap={16}>
            <span>{mediatorCopy('runLede')}</span>
            <fieldset style={FIELDSET}>
              <legend className={LEGEND_CAPS} style={LEGEND}>
                {mediatorCopy('encounter')}
              </legend>
              {choices.map(({ encounter, otherGame }) => (
                <Radio
                  key={encounter.id}
                  name={`${id}-encounter`}
                  value={encounter.id}
                  checked={picked?.id === encounter.id}
                  onChange={() => setChosen(encounter.id)}
                  label={encounter.name}
                  description={choiceLine({ encounter, otherGame })}
                />
              ))}
            </fieldset>
            {onTray > 0 && (
              <fieldset style={FIELDSET}>
                <legend className={LEGEND_CAPS} style={LEGEND}>
                  {mediatorCopy('theOppositionOnTheTray')}
                </legend>
                <Radio
                  name={`${id}-tray`}
                  checked={!clear}
                  onChange={() => setClear(false)}
                  label={mediatorCopy('addToIt')}
                />
                <Radio
                  name={`${id}-tray`}
                  checked={clear}
                  onChange={() => setClear(true)}
                  label={trayChoiceLabel(onTray)}
                />
              </fieldset>
            )}
            {!sessionLive && (
              <Checkbox
                checked={startSession}
                onChange={(e) => setStartSession(e.target.checked)}
                words={mediatorCopy('startTheSessionToo')}
              />
            )}
          </Stack>
        )
      }
      confirmLabel={
        picked === null
          ? mediatorCopy('closeDialog')
          : mediatorCopy('runNamed', { name: picked.name })
      }
      pendingLabel={mediatorCopy('runningPending')}
      tone={clear && onTray > 0 ? 'danger' : 'default'}
      onConfirm={async () => {
        if (picked === null) return
        const { added } = await onRun(picked.id, clear && onTray > 0, sessionLive || startSession)
        toast.success(mediatorCopy('runningAdded', { name: picked.name, added }))
        setClear(false)
        setStartSession(true)
      }}
    />
  )
}
