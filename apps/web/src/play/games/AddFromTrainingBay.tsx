/**
 * AddFromTrainingBay — beside the Game page's "+ New…" buttons: bring one of
 * your own units already built into this Game, rather than only making new
 * ones. The pick dialog lists your pilots and mechs still in your Training Bay,
 * and, for the table runner of a Game with no crawler, your crawlers.
 *
 * Picking one makes the Training Bay's own move (`requestMove`, ADR-037): the
 * same record changes container, asking first when the move clears an
 * assignment. Nothing is copied.
 */

import type { Container, ContainerFields } from 'game-domain/container'
import { containerOf, moveTo } from 'game-domain/container'
import type { EntityKind } from 'game-domain/entityKinds'
import { useState } from 'react'
import { requestMove } from '../../build/entityContainer/requestMove.model'
import { PickDialog } from '../../components/app'
import { Button, toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { failureMessage } from '../../lib/connection/useServerAction'
import { useCrawlers, useMechs, usePilots } from '../../lib/entities'
import { unitRowModel } from '../../lib/units/unitModel'
import { playGamesCopy } from '../../messages/play-games'
import { CONTAINER_MOVE } from '../../replica/provenance'
import { useSync } from '../../replica/syncContext'
import { useUnits } from '../../replica/units'

type Movable = { id: string; name: string; kind: EntityKind }

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
  const [selected, setSelected] = useState<string | null>(null)
  const { canWrite } = useSync()
  const onShelf = <T extends ContainerFields & { id: string; name: string }>(
    list: readonly T[],
    kind: EntityKind
  ) =>
    list
      .filter((e) => containerOf(e).kind === 'shelf')
      .map((e): Movable => ({ id: e.id, name: e.name, kind }))
  // Every hook on every render; the crawlers are offered only when allowed.
  const livePilots = usePilots()
  const liveMechs = useMechs()
  const liveCrawlers = useCrawlers()
  const pilots = onShelf(livePilots, 'pilot')
  const mechs = onShelf(liveMechs, 'mech')
  const crawlers = crawler ? onShelf(liveCrawlers, 'crawler') : []
  const all = [...pilots, ...mechs, ...crawlers]
  const group = (key: string, title: string, units: readonly Movable[]) => ({
    key,
    title,
    choices: units.map((u) => ({
      id: u.id,
      label: u.name,
      model: unitRowModel({ kind: u.kind as 'pilot' | 'mech' | 'crawler', name: u.name }),
    })),
  })

  function bring(unit: Movable) {
    const next: Container = { kind: 'game', gameId }
    const move = async (to: Container) => {
      await useUnits.getState().update(unit.kind, unit.id, moveTo(to), CONTAINER_MOVE)
      toast.success(playGamesCopy('broughtIn', { name: unit.name }))
    }
    setOpen(false)
    requestMove({
      entityType: unit.kind,
      entityId: unit.id,
      name: unit.name,
      current: { kind: 'shelf' },
      next,
      gameName: (id) => (id === gameId ? gameName : null),
      confirm,
      move,
      moveNow: (to) => {
        move(to).catch((err: unknown) =>
          toast.error(failureMessage(err, playGamesCopy('couldNotBringIn', { name: unit.name })))
        )
      },
    })
  }

  return (
    <>
      <Button
        variant="default"
        size="compact"
        disabled={!canWrite}
        onClick={() => {
          setSelected(null)
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
          group('pilots', playGamesCopy('bringPilots'), pilots),
          group('mechs', playGamesCopy('bringMechs'), mechs),
          group('crawlers', playGamesCopy('bringCrawlers'), crawlers),
        ]}
        empty={playGamesCopy('nothingInYourTrainingBay')}
        selected={selected}
        onSelect={setSelected}
        note={playGamesCopy('bringNote')}
        confirmLabel={playGamesCopy('moveIn')}
        confirm={
          selected === null
            ? undefined
            : () => {
                const unit = all.find((u) => u.id === selected)
                if (unit) bring(unit)
              }
        }
      />
    </>
  )
}
