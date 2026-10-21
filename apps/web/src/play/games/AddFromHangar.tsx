/**
 * AddFromHangar — a roster column's "Move in…" chip on a Game's page (ADR-052
 * §5, wireframe add-from-hangar): a single-choice picker of your units of that
 * column's kind that could move into this Game, then the same move Build's
 * "Move to a Game…" makes (`requestMove`), one unit per add. It is a chip in
 * the column's head, beside its create chip, never a block under the columns:
 * a contextual action lives on the head of what it acts on.
 *
 * The dialog is the one pick dialog (`PickDialog`, chrome K7): radio Compacts (EDL
 * select mode) under the column's Slab, in one radio group, so exactly one is
 * picked. Each Compact shows its relation chips — the Game it would leave, the unit
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
import { splitRelations } from '../../lib/shelves/shelfItems'
import { unitRowModel } from '../../lib/units/unitModel'
import { useEntityStore } from '../../stores/entityStore'
import { CONTAINER_MOVE } from '../../stores/surfaceProvenance'
import type { HangarChoice, HangarKind } from './addFromHangar.model'
import { HANGAR_GROUPS, hangarChoices } from './addFromHangar.model'

type AddFromHangarProps = {
  gameId: string
  /** The column it heads: the picker offers only units of this kind. */
  kind: HangarKind
  /** The Game's name, for the toast and the confirms; null while unknown. */
  gameName: string | null
  /** The page's confirm (`useConfirm`), which outlives this dialog. */
  confirm: Confirm
}

export function AddFromHangar({ gameId, kind, gameName, confirm }: AddFromHangarProps) {
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
  const groups = HANGAR_GROUPS.filter((g) => g.kind === kind)
  const all = choices === null ? [] : groups.flatMap((g) => choices[g.kind])
  const chosen = all.find((c) => key(c) === picked) ?? null
  const here = gameName ?? 'this Game'
  // The chip's name and the dialog's: three columns, three chips, each named.
  const title = `Move a ${kind} in from your Training Bay`

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
      <Button
        size="compact"
        aria-haspopup="dialog"
        aria-label={title}
        onClick={() => {
          setPicked(null)
          setOpen(true)
        }}
      >
        Move in…
      </Button>
      <PickDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={`Choose one of your ${NOUN[kind]} to move into ${here}.`}
        loading="your Training Bay"
        groups={
          choices === null
            ? undefined
            : groups.map((group) => ({
                key: group.kind,
                title: group.title,
                choices: choices[group.kind].map((choice) => ({
                  id: key(choice),
                  label: choice.name,
                  model: unitRowModel({ kind: choice.kind, name: choice.name }),
                  ...(() => {
                    const { linked, chips } = splitRelations(choice.relations)
                    return {
                      relations: chips.map((r) =>
                        relation(r.key, r.label, r.value, { href: r.href })
                      ),
                      linked,
                    }
                  })(),
                })),
              }))
        }
        empty={`None of your ${NOUN[kind]} can move into ${here}. Create one for it from the roster.`}
        selected={picked}
        onSelect={setPicked}
        confirmLabel={chosen === null ? 'Move in' : `Move ${chosen.name} in`}
        confirm={chosen ? () => add(chosen) : undefined}
      />
    </>
  )
}

/** The column's units, in the dialog's sentences. */
const NOUN: Record<HangarKind, string> = { pilot: 'pilots', mech: 'mechs', crawler: 'crawlers' }

/** A choice's radio value: kinds share no ids, but say which anyway. */
function key(choice: Pick<HangarChoice, 'kind' | 'id'>): string {
  return `${choice.kind}:${choice.id}`
}
