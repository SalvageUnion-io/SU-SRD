/**
 * AddFromTrainingBay — beside the Game page's "+ New…" buttons: bring units of
 * your own already built into this Game, rather than only making new ones. The
 * pick dialog lists your pilots and mechs still in your Training Bay, and, for
 * the table runner of a Game with no crawler, your crawlers. Several may be
 * picked at once, and a pilot's line carries the mech assigned to them: the
 * pair moves together and stays assigned (`addFromTrainingBay.model.ts`).
 *
 * Each one makes the Training Bay's own move (ADR-037): the same record
 * changes container, and nothing is copied. An assignment to something left
 * behind is cleared, so the dialog asks first, naming each.
 *
 * With nothing to bring it says which nothing (none built yet, or all of it in
 * a Game already) and offers the ways to have one: build it here, or copy one
 * from the Starter Set.
 */

import type { Container } from 'game-domain/container'
import { moveTo } from 'game-domain/container'
import { pilotLabel } from 'game-domain/pilotLabel'
import { useState } from 'react'
import { PickDialog } from '../../components/app'
import { Button, toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { failureMessage } from '../../lib/connection/useServerAction'
import { useCrawlers, useOwnUnits } from '../../lib/entities'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { assignLink } from '../../lib/links/assignLink'
import { assignmentsClearedByMove } from '../../lib/links/clearedByMove'
import { unitRowModel } from '../../lib/units/unitModel'
import { newInGameHref } from '../../lib/wizard/fromGame'
import { playGamesCopy } from '../../messages/play-games'
import { CONTAINER_MOVE } from '../../replica/provenance'
import { useSync } from '../../replica/syncContext'
import { useUnits } from '../../replica/units'
import type { BringChoice } from './addFromTrainingBay.model'
import { bringChoices, bringPlan } from './addFromTrainingBay.model'

export function AddFromTrainingBay({
  gameId,
  gameName,
  crawler,
  confirm,
}: {
  gameId: string
  gameName: string | null
  /** The viewer may bring a crawler: they run this Game and it has none. */
  crawler: boolean
  /** The page's confirm, which outlives the dialog. */
  confirm: Confirm
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<readonly string[]>([])
  const { canWrite } = useSync()
  // Every hook on every render; the crawlers are offered only when allowed.
  // The viewer's own: the replica holds every crewmate's too, which would
  // make "nothing built yet" read "all of it is in a Game already" (LG-10).
  const pilots = useOwnUnits('pilot')
  const mechs = useOwnUnits('mech')
  const crawlers = useCrawlers()
  const softLinks = useUnits((s) => s.softLinks)
  const offer = bringChoices({
    pilots: pilots.map((p) => ({ ...p, label: pilotLabel(p) })),
    mechs,
    crawlers,
    softLinks,
    crawler,
  })
  const all = [...offer.pilots, ...offer.mechs, ...offer.crawlers]
  const picked = all.filter((choice) => selected.includes(choice.id))
  const group = (key: string, title: string, units: readonly BringChoice[]) => ({
    key,
    title,
    choices: units.map((u) => ({
      id: u.id,
      label: u.name,
      model: unitRowModel({ kind: u.kind as 'pilot' | 'mech' | 'crawler', name: u.name }),
      // Their mech comes with them, as its Mini says.
      ...(u.mech ? { linked: [{ key: u.mech.id, kind: 'mech' as const, name: u.mech.name }] } : {}),
    })),
  })

  function bring(choices: readonly BringChoice[]) {
    const next: Container = { kind: 'game', gameId }
    const store = useUnits.getState()
    const { moves, keep, pair } = bringPlan(choices, store.softLinks)
    // What the move clears, less the links that come through it.
    const held = { ...store, softLinks: store.softLinks.filter((l) => !keep.includes(l)) }
    const clearing = moves.flatMap((unit) => {
      const cleared = assignmentsClearedByMove(held, { type: unit.kind, id: unit.id }, next)
      return cleared.length === 0 ? [] : [{ unit, cleared }]
    })
    const names = moves.map((m) => m.name)
    const move = async () => {
      for (const unit of moves) {
        await useUnits.getState().update(unit.kind, unit.id, moveTo(next), CONTAINER_MOVE)
      }
      // The move pruned every link of theirs; these have both ends in the Game now.
      for (const { id: _id, createdAt: _createdAt, ...link } of keep) {
        await useUnits.getState().create('softLink', link)
      }
      // One pilot on foot and one free mech, moved in together, are a pair
      // (LG2-07): assigned on arrival, with the way back in the notice.
      const drawn =
        pair === null
          ? null
          : await assignLink(
              { type: 'mech', id: pair.mech.id },
              { type: 'pilot', id: pair.pilot.id }
            )
      const moved =
        names.length === 1
          ? playGamesCopy('broughtIn', { name: names[0] ?? '' })
          : playGamesCopy('broughtInMany', { count: String(names.length) })
      if (pair === null || drawn === null) {
        toast.success(moved)
        return
      }
      toast.success(
        `${moved} ${playGamesCopy('mechAssignedTo', { mech: pair.mech.name, pilot: pair.pilot.name })}`,
        {
          action: {
            label: playGamesCopy('undo'),
            onClick: () => void useUnits.getState().delete('softLink', drawn.id),
          },
        }
      )
    }
    const failure =
      names.length === 1
        ? playGamesCopy('couldNotBringIn', { name: names[0] ?? '' })
        : playGamesCopy('couldNotBringInMany')
    setOpen(false)
    if (clearing.length === 0) {
      move().catch((err: unknown) => toast.error(failureMessage(err, failure)))
      return
    }
    const asked = clearing.map(({ unit, cleared }) =>
      ROW_ACTION_COPY.enterGame({ name: unit.name, kind: unit.kind, game: gameName, cleared })
    )
    const [only] = asked
    confirm({
      ...(asked.length === 1 && moves.length === 1 && only !== undefined
        ? only
        : {
            ...(only as (typeof asked)[number]),
            title: playGamesCopy('moveTheseIn', { game: gameName ?? playGamesCopy('thisGame') }),
            // Each unit's own lines, named, between the dialog's first and last.
            body: [
              ...clearing.flatMap(({ unit }, i) =>
                (asked[i]?.body ?? []).slice(1, -1).map((line) => `${unit.name}: ${line}`)
              ),
              playGamesCopy('moveTheseBack'),
            ],
            failure,
          }),
      onConfirm: move,
    })
  }

  return (
    <>
      <Button
        variant="default"
        size="compact"
        disabled={!canWrite}
        onClick={() => {
          setSelected([])
          setOpen(true)
        }}
      >
        {playGamesCopy('addFromTrainingBay')}
      </Button>
      <PickDialog
        open={open}
        onOpenChange={setOpen}
        title={playGamesCopy('bringIntoThisGame')}
        groups={[
          group('pilots', playGamesCopy('bringPilots'), offer.pilots),
          group('mechs', playGamesCopy('bringMechs'), offer.mechs),
          group('crawlers', playGamesCopy('bringCrawlers'), offer.crawlers),
        ]}
        empty={
          offer.owned === 0
            ? playGamesCopy('nothingBuiltYet')
            : playGamesCopy('nothingInYourTrainingBay')
        }
        // Nothing to bring: the ways to have one, here or from the Starter Set.
        doors={
          all.length > 0 ? undefined : (
            <>
              <Button href={newInGameHref('/pilots/new', gameId)} variant="default" size="compact">
                {playGamesCopy('newPilot')}
              </Button>
              <Button href={newInGameHref('/mechs/new', gameId)} variant="default" size="compact">
                {playGamesCopy('newMech')}
              </Button>
              <Button href="/starter" variant="default" size="compact">
                {playGamesCopy('starterSet')}
              </Button>
            </>
          )
        }
        selected={null}
        many={selected}
        onSelect={(id) =>
          setSelected((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]))
        }
        note={playGamesCopy('bringNote')}
        confirmLabel={playGamesCopy('moveIn')}
        confirm={picked.length === 0 ? undefined : () => bring(picked)}
      />
    </>
  )
}
