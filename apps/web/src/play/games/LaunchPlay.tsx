/**
 * LaunchPlay — a member's way into Play for a pilot from the Game hub: a
 * **Play** chip button in the Game band (`GameBand`'s `actions`), and a dialog
 * that asks which pilot to play. The Mediator's own way in is the band's
 * **Mediate** link; a Mediator who also plays a pilot here gets Play beside it,
 * and one who plays none sees no Play (`onlyWithPilots`).
 *
 * The button is always there: Play runs a Game with or without a Mediator
 * (ADR-051 §4).
 *
 * ## One choice: the pilot
 *
 * The dialog (`PickDialog`) lists the Game's pilots — each its Compact in select
 * mode (EDL "Modes"), who holds it right of the name — in the roster's own order: yours first
 * (`groupColumn`), then the crew's — and pre-selects the first one you own. A
 * viewer who owns none of those listed gets no pre-selection and picks one.
 * Nothing else is asked: the mech and the crawler follow from the pilot's own
 * assignments once Play opens.
 *
 * ## Only pilots this browser holds
 *
 * It lists only the Game's pilots this browser holds a copy of, because those
 * are the only ones Play can open: `PlayGate` reads the pilot from the local
 * store, which never holds a crewmate's pilot (`SheetView`'s header says why).
 * Offering a crewmate's pilot, or a pre-gen this browser never made, would send
 * every such choice to the gate's "Pilot not found". Those stay on the roster,
 * where their read-only sheets open. A viewer who holds none of the Game's
 * pilots — a Mediator who plays nobody, say — gets the dialog's empty state
 * saying so instead of a choice.
 *
 * Connected only: `GameHub` mounts it, and `Roster` mounts the hub only when
 * the mode is Connected, so every hook below has a provider.
 */

import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, PickDialog } from '../../components/index'
import { useHydrateEntities, usePilots } from '../../lib/entities'
import type { RosterRow } from '../../lib/games/gameRoster'
import { groupColumn, ownableRows } from '../../lib/games/gameRoster'
import { unitRowModel } from '../../lib/units/unitModel'
import { playCopy } from '../../messages/play'
import { playGamesCopy } from '../../messages/play-games'
import { useGamesQuery, useViewerId } from '../../replica/roomCalls'
import { OwnerSeal } from './OwnerSeal'

/** The pilot a viewer is offered first: their own, in the roster's order. */
function preselect(pilots: readonly RosterRow[]): string | null {
  return pilots.find((row) => row.owner?.mine === true)?.serverId ?? null
}

export function LaunchPlay({
  gameId,
  onlyWithPilots = false,
  live = false,
}: {
  gameId: string
  /** Show nothing until this browser holds one of the Game's pilots (the Mediator's Play). */
  onlyWithPilots?: boolean
  /** A group session is live: the chip reads Join session. */
  live?: boolean
}) {
  // Probed rather than required, as `GameRoster` and `AppLink` do: component
  // tests render the hub without a RouterProvider.
  const router = useRouter({ warn: false })
  const [open, setOpen] = useState(false)
  // The player's own pick. Until they make one, the selection follows
  // `preselect`, so a listing that answers after the picker opened still
  // arrives with their pilot chosen.
  const [picked, setPicked] = useState<string | null>(null)

  // The same three questions `GameRoster` asks, so the Worker answers both from
  // one subscription each.
  const viewerId = useViewerId()
  const members = useGamesQuery('games.members', { gameId: gameId })
  const listing = useGamesQuery('entities.listForGame', { gameId: gameId })
  // What this browser holds decides what may be offered: see the header.
  useHydrateEntities(['pilot'])
  const localPilots = usePilots()

  // Nothing until the crew is known: a button that appears and then vanishes
  // when the members answer would be worse than a beat of nothing.
  if (members === undefined) return null

  const { yours, others } = groupColumn(
    ownableRows({
      kind: 'pilot',
      rows: listing?.pilots ?? [],
      viewerId,
      members,
      localIds: new Set(localPilots.map((p) => p.id)),
    }).filter((row) => row.localId !== null)
  )
  const pilots = [...yours, ...others]
  if (onlyWithPilots && pilots.length === 0) return null
  const selected = picked ?? preselect(pilots)
  const chosen = pilots.find((row) => row.serverId === selected) ?? null

  function openPicker() {
    setPicked(null)
    setOpen(true)
  }

  function launch() {
    if (chosen?.localId == null) return
    setOpen(false)
    // The local id: the one `PlayGate` looks the pilot up by.
    void router?.navigate({ to: '/play/pilots/$pilotId', params: { pilotId: chosen.localId } })
  }

  return (
    <>
      <Button variant="ink" size="compact" onClick={openPicker}>
        {live ? playCopy('joinSession') : playGamesCopy('play')}
      </Button>
      <PickDialog
        open={open}
        onOpenChange={setOpen}
        title={playGamesCopy('play')}
        description={playGamesCopy('chooseThePilotToPlay')}
        loading="pilots"
        groups={
          listing === undefined
            ? undefined
            : [
                {
                  key: 'pilots',
                  choices: pilots.map((row) => ({
                    id: row.serverId,
                    label: row.name,
                    model: unitRowModel({ kind: 'pilot', name: row.name }),
                    // Who holds it, right of the name (ruleset §7.2), as the roster says it.
                    labels:
                      row.owner === null ? undefined : (
                        <OwnerSeal
                          owner={row.owner}
                          assignable={false}
                          disabled
                          onAssign={() => undefined}
                        />
                      ),
                  })),
                },
              ]
        }
        empty={playGamesCopy('noneOfThisGamesPilots')}
        selected={selected}
        onSelect={setPicked}
        confirmLabel={playGamesCopy('play')}
        confirm={chosen === null ? undefined : launch}
      />
    </>
  )
}
