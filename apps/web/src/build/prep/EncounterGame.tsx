/**
 * The field that chooses the Game an encounter is prepared for (ADR-067 §3).
 * An encounter for no Game is for any; one for a Game is listed and ordered
 * in that Game's Prep. Only the Games the Mediator runs are offered.
 */

import type { Encounter } from 'game-domain/schemas/encounter'
import { useId } from 'react'
import { Field, Select } from '../../components/index'
import { buildPrepCopy } from '../../messages/build-prep'
import { useRunGames } from './useEncounterGame'

/** "For": which Game it is prepared for, or any. Shown while editing. */
export function EncounterGameField({
  encounter,
  onChange,
}: {
  encounter: Pick<Encounter, 'gameId'>
  /** The chosen Game's id, or undefined for any. */
  onChange: (gameId: string | undefined) => void
}) {
  const id = useId()
  const games = useRunGames(true)
  if (games.length === 0) return null
  return (
    <Field label={buildPrepCopy('forGame')} htmlFor={id}>
      <Select
        id={id}
        value={encounter.gameId ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
      >
        <option value="">{buildPrepCopy('anyGame')}</option>
        {games.map((g) => (
          <option key={g._id} value={g._id}>
            {g.name}
          </option>
        ))}
      </Select>
    </Field>
  )
}
