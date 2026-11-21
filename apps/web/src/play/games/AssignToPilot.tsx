/**
 * AssignToPilot — a Crew mech row's "Assign to a Pilot…": pair one of your
 * mechs with one of your pilots in this Game without leaving its page.
 *
 * The pick dialog lists your pilots here, each with the mech they have now (an
 * assignment replaces it, ADR-037), and chooses the one with no mech when
 * there is exactly one. Assign draws the link (`assignLink`); a refusal stays
 * in the dialog.
 */

import { pilotLabel } from 'game-domain/pilotLabel'
import { useState } from 'react'
import { PickDialog } from '../../components/app'
import { toast } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { useMechs, usePilots } from '../../lib/entities'
import { assignLink } from '../../lib/links/assignLink'
import { soleMechlessPilot } from '../../lib/links/mechlessPilot'
import { unitRowModel } from '../../lib/units/unitModel'
import { playGamesCopy } from '../../messages/play-games'
import { useUnits } from '../../replica/units'

type AssignToPilotProps = {
  gameId: string
  /** The mech being assigned (its local id), or null while the dialog is closed. */
  mech: { id: string; name: string } | null
  onClose: () => void
}

export function AssignToPilot({ gameId, mech, onClose }: AssignToPilotProps) {
  const [picked, setPicked] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // This browser holds only your own: the pilots you may pair it with.
  const pilots = usePilots().filter((p) => p.gameId === gameId)
  const mechs = useMechs()
  const softLinks = useUnits((s) => s.softLinks)
  const mechOf = (pilotId: string) => {
    const id = softLinks.find((l) => l.type === 'mech-to-pilot' && l.to.id === pilotId)?.from.id
    return id === undefined ? null : (mechs.find((m) => m.id === id) ?? null)
  }
  // The pilot it is plainly for, until the player picks another.
  const selected = picked ?? soleMechlessPilot(pilots, softLinks, gameId)?.id ?? null
  const chosen = pilots.find((p) => p.id === selected) ?? null

  function close() {
    setPicked(null)
    setError(null)
    onClose()
  }

  async function assign() {
    if (mech === null || chosen === null) return
    setPending(true)
    setError(null)
    try {
      await assignLink({ type: 'mech', id: mech.id }, { type: 'pilot', id: chosen.id })
      toast.success(playGamesCopy('mechAssignedTo', { mech: mech.name, pilot: pilotLabel(chosen) }))
      close()
    } catch (err) {
      setError(failureMessage(err, playGamesCopy('mechNotAssigned', { mech: mech.name })))
    } finally {
      setPending(false)
    }
  }

  return (
    <PickDialog
      open={mech !== null}
      onOpenChange={(open) => {
        if (!open) close()
      }}
      title={playGamesCopy('assignMechToAPilot', { name: mech?.name ?? '' })}
      groups={[
        {
          key: 'pilots',
          title: playGamesCopy('yourPilotsHere'),
          choices: pilots.map((p) => {
            const flies = mechOf(p.id)
            return {
              id: p.id,
              label: pilotLabel(p),
              model: unitRowModel({ kind: 'pilot', name: pilotLabel(p) }),
              // The mech they have now, which this assignment replaces.
              ...(flies !== null && flies.id !== mech?.id
                ? { linked: [{ key: flies.id, kind: 'mech' as const, name: flies.name }] }
                : {}),
            }
          }),
        },
      ]}
      empty={playGamesCopy('noPilotOfYoursHere')}
      selected={selected}
      onSelect={setPicked}
      note={playGamesCopy('assignReplaces')}
      error={error}
      confirmLabel={playGamesCopy('assign')}
      confirm={chosen === null ? undefined : () => void assign()}
      pending={pending}
    />
  )
}
