/**
 * LaunchPlay — a member's way into Play for a pilot from the Game hub: the
 * Game's door in its band (`GameBand`'s `actions`), **Open table**, or **Join
 * session** while a group session is live, and a dialog that asks which pilot
 * to play, its act **Play** and the pilot. The Mediator's own way in is the band's
 * **Mediate** link; a Mediator who also plays a pilot here gets Play beside it,
 * and one who plays none sees no Play (`onlyWithPilots`).
 *
 * The button is always there: Play runs a Game with or without a Mediator
 * (ADR-051 §4).
 *
 * ## One choice: the pilot
 *
 * Only the pilots assigned to you are yours to play, so only those are
 * offered: a crewmate's and an unassigned one stay on the Crew list, where
 * their sheets open and a free one is assigned first. With exactly one, there
 * is nothing to choose and the button opens Play for it, also when it was
 * pressed before the pilots had answered. With several, the
 * dialog (`PickDialog`) lists them, each its Compact in select mode (EDL
 * "Modes"), in the roster's own order, the first chosen. Nothing else is
 * asked: the mech and the crawler follow from the pilot's own assignments once
 * Play opens. A viewer with none (a Mediator who plays nobody, say) gets the
 * dialog's empty state saying so instead of a choice.
 *
 * Play opens the pilot from the replica (`PlayGate`), so a pilot it does not
 * hold yet is not offered either.
 *
 * Connected only: `GameHub` mounts it, and `Roster` mounts the hub only when
 * the mode is Connected, so every hook below has a provider.
 */

import { useRouter } from '@tanstack/react-router'
import { pilotCallsign } from 'game-domain/pilotLabel'
import { useEffect, useState } from 'react'
import { PickDialog } from '../../components/app'
import { Button } from '../../components/index'
import { useHydrateEntities, usePilots } from '../../lib/entities'
import type { RosterRow } from '../../lib/games/gameRoster'
import { ownableRows } from '../../lib/games/gameRoster'
import { unitRowModel } from '../../lib/units/unitModel'
import { playCopy } from '../../messages/play'
import { playGamesCopy } from '../../messages/play-games'
import { useGameListing } from '../../replica/gameListing'
import { useViewerId } from '../../replica/roomCalls'
import { useTableRead } from '../../replica/useTable'
import { OwnerSeal } from './OwnerSeal'

/** The pilot a viewer is offered first: their first, in the roster's order. */
function preselect(pilots: readonly RosterRow[]): string | null {
  return pilots[0]?.serverId ?? null
}

export function LaunchPlay({
  gameId,
  onlyWithPilots = false,
  live = false,
  door: roleDoor = false,
}: {
  gameId: string
  /** Show nothing until this browser holds one of the Game's pilots (the Mediator's Play). */
  onlyWithPilots?: boolean
  /** A group session is live: the chip reads Join session. */
  live?: boolean
  /** Play is this viewer's door, the band's one rust button. */
  door?: boolean
}) {
  // Probed rather than required, as `GameRoster` and `AppLink` do: component
  // tests render the hub without a RouterProvider.
  const router = useRouter({ warn: false })
  const [open, setOpen] = useState(false)
  // The player's own pick. Until they make one, the selection follows
  // `preselect`, so a listing that answers after the picker opened still
  // arrives with their pilot chosen.
  const [picked, setPicked] = useState<string | null>(null)
  // The door was pressed while the pilots were still loading.
  const [waiting, setWaiting] = useState(false)

  // The same three questions `GameRoster` asks, so the Worker answers both from
  // one subscription each.
  const viewerId = useViewerId()
  const members = useTableRead('games.members', { gameId })
  const listing = useGameListing(gameId)
  // What this browser holds decides what may be offered: see the header.
  useHydrateEntities(['pilot'])
  const localPilots = usePilots()

  const pilots = ownableRows({
    kind: 'pilot',
    rows: listing?.pilots ?? [],
    viewerId,
    members: members ?? [],
    localIds: new Set(localPilots.map((p) => p.id)),
  }).filter((row) => row.owner?.mine === true && row.localId !== null)
  const selected = picked ?? preselect(pilots)
  const chosen = pilots.find((row) => row.serverId === selected) ?? null
  // One pilot of yours is no choice (LG-24).
  const only = listing !== undefined && pilots.length === 1 ? (pilots[0] ?? null) : null

  function play(row: RosterRow | null) {
    if (row?.localId == null) return
    setOpen(false)
    setWaiting(false)
    // The local id: the one `PlayGate` looks the pilot up by.
    void router?.navigate({ to: '/pilots/$id/play', params: { id: row.localId } })
  }

  // The answer a press was waiting on shows one pilot of yours: in it goes,
  // with no second press on a dialog that has nothing to choose.
  const goIn = waiting && open ? (only?.localId ?? null) : null
  // biome-ignore lint/correctness/useExhaustiveDependencies: fires on the answer, not on `play`'s identity
  useEffect(() => {
    if (goIn !== null) play(only)
  }, [goIn])

  // Nothing until the crew is known: a button that appears and then vanishes
  // when the members answer would be worse than a beat of nothing.
  if (members === undefined) return null
  if (onlyWithPilots && pilots.length === 0) return null

  // The Game's own door: Join session while one is live, else Open table. A
  // pilot's door, here the dialog's act, says Play (glossary §9).
  const door = live ? playCopy('joinSession') : playCopy('openTable')

  function openPicker() {
    if (only !== null) return play(only)
    setPicked(null)
    setOpen(true)
    // Pressed before the pilots answered: the press still means "take me in".
    setWaiting(listing === undefined)
  }

  const launch = () => play(chosen)

  return (
    <>
      {/* Play is rust only as its role's door (§1.9): the one act whose look
          the viewer's role picks, so act-twin reads past it. */}
      <Button
        variant={roleDoor ? 'primary' : 'default'}
        size="compact"
        data-role-door=""
        onClick={openPicker}
      >
        {door}
      </Button>
      <PickDialog
        open={open}
        onOpenChange={setOpen}
        title={door}
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
        // The pick is a pilot, so its act says Play and who (glossary §9).
        confirmLabel={
          chosen === null
            ? playGamesCopy('play')
            : playCopy('playPilot', { name: pilotCallsign(chosen.body) })
        }
        confirm={chosen === null ? undefined : launch}
      />
    </>
  )
}
