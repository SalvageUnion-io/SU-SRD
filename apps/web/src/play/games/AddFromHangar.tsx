/**
 * AddFromHangar — "+ Move in from your Hangar" under a Game's roster (ADR-052 §5,
 * wireframe add-from-hangar): a single-choice picker of your units that could
 * move into this Game, then the same move Build's "Move to a Game…" makes
 * (`requestMove`), one unit per add.
 *
 * The dialog is the one pick dialog (`PickDialog`, chrome K7): radio Rows (EDL
 * select mode) grouped under Pilots, Mechs and Crawlers Slabs, in one radio
 * group, so exactly one is picked. Each Row shows its relation chips — the Game it would leave, the unit
 * it is assigned to — so what the move touches is visible before it runs
 * (`hangarChoices`). Moving out of another Game, or clearing an assignment,
 * asks first: that is `requestMove`'s, on the page's confirm, which outlives
 * this dialog.
 *
 * Connected only: `GameRoster` mounts it on the Game's page.
 */

import { useQuery } from 'convex/react'
import type { Container } from 'game-domain/container'
import { moveTo } from 'game-domain/container'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { requestMove } from '../../build/entityContainer/requestMove.model'
import { Button, PickDialog, relation, toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { failureMessage } from '../../lib/connection/useServerAction'
import { useCrawlers, useMechs, usePilots, useSoftLinkList } from '../../lib/entities'
import { unitRowModel } from '../../lib/units/unitModel'
import { useEntityStore } from '../../stores/entityStore'
import { CONTAINER_MOVE } from '../../stores/surfaceProvenance'
import type { HangarChoice } from './addFromHangar.model'
import { HANGAR_GROUPS, hangarChoices } from './addFromHangar.model'

type AddFromHangarProps = {
  gameId: string
  /** The Game's name, for the toast and the confirms; null while unknown. */
  gameName: string | null
  /** The page's confirm (`useConfirm`), which outlives this dialog. */
  confirm: Confirm
}

export function AddFromHangar({ gameId, gameName, confirm }: AddFromHangarProps) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const games = useQuery(api.games.listMine, {})
  const pilots = usePilots()
  const mechs = useMechs()
  const crawlers = useCrawlers()
  const softLinks = useSoftLinkList()

  const choices =
    games === undefined
      ? null
      : hangarChoices({ gameId, pilots, mechs, crawlers, softLinks, games })
  const all = choices === null ? [] : HANGAR_GROUPS.flatMap((g) => choices[g.kind])
  const chosen = all.find((c) => key(c) === picked) ?? null
  const here = gameName ?? 'this Game'

  function gameNameOf(id: string): string | null {
    return games?.find((g) => g._id === id)?.name ?? null
  }

  function add(choice: HangarChoice) {
    setOpen(false)
    const next: Container = { kind: 'game', gameId }
    const move = async (to: Container) => {
      await useEntityStore.getState().update(choice.kind, choice.id, moveTo(to), CONTAINER_MOVE)
      toast.success(`Moved ${choice.name} to ${here}.`)
    }
    requestMove({
      entityType: choice.kind,
      entityId: choice.id,
      name: choice.name,
      current: choice.current,
      next,
      gameName: gameNameOf,
      confirm,
      move,
      moveNow: (to) => {
        move(to).catch((err: unknown) =>
          toast.error(failureMessage(err, `${choice.name} could not be moved. Try again.`))
        )
      },
    })
  }

  return (
    <>
      <div>
        <Button
          variant="ink"
          size="compact"
          onClick={() => {
            setPicked(null)
            setOpen(true)
          }}
        >
          + Move in from your Hangar
        </Button>
      </div>
      <PickDialog
        open={open}
        onOpenChange={setOpen}
        title="Move in from your Hangar"
        description={`Choose one of your units to move into ${here}.`}
        loading="your Hangar"
        groups={
          choices === null
            ? undefined
            : HANGAR_GROUPS.map((group) => ({
                key: group.kind,
                title: group.title,
                choices: choices[group.kind].map((choice) => ({
                  id: key(choice),
                  label: choice.name,
                  model: unitRowModel({ kind: choice.kind, name: choice.name }),
                  relations: choice.relations.map((r) =>
                    relation(r.key, r.label, r.value, { href: r.href })
                  ),
                })),
              }))
        }
        empty={`Nothing in your Hangar can move into ${here}. Create a unit for it from the roster.`}
        selected={picked}
        onSelect={setPicked}
        confirmLabel={chosen === null ? 'Move in' : `Move ${chosen.name} in`}
        confirm={chosen ? () => add(chosen) : undefined}
      />
    </>
  )
}

/** A choice's radio value: kinds share no ids, but say which anyway. */
function key(choice: Pick<HangarChoice, 'kind' | 'id'>): string {
  return `${choice.kind}:${choice.id}`
}
