/**
 * AddFromHangar — "+ Add from your Hangar" under a Game's roster (ADR-052 §5,
 * wireframe add-from-hangar): a single-choice picker of your units that could
 * move into this Game, then the same move Build's "Move to a Game…" makes
 * (`requestMove`), one unit per add.
 *
 * The dialog is narrow (chrome K7): radio Rows (EDL select mode) grouped under
 * Pilots, Mechs and Crawlers Slabs, in one radio group, so exactly one is
 * picked. Each Row shows its relation chips — the Game it would leave, the unit
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
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { requestMove } from '../../build/entityContainer/requestMove.model'
import {
  Button,
  DialogActions,
  Entity,
  ModalShell,
  Pending,
  RadioCardGroup,
  relation,
  Slab,
  Text,
  toast,
  tokens,
} from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { failureMessage } from '../../lib/connection/useServerAction'
import { useCrawlers, useMechs, usePilots, useSoftLinkList } from '../../lib/entities'
import { unitRowModel } from '../../lib/units/unitModel'
import { useEntityStore } from '../../stores/entityStore'
import { CONTAINER_MOVE } from '../../stores/surfaceProvenance'
import type { HangarChoice } from './addFromHangar.model'
import { HANGAR_GROUPS, hangarChoices } from './addFromHangar.model'

const BODY = {
  backgroundColor: tokens.color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  padding: tokens.space[20],
} satisfies CSSProperties

/** The three groups, one radio group: 16px between them. */
const GROUPS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
} satisfies CSSProperties

/** One group: its Slab, then its Rows 8px apart. */
const GROUP = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

const HINT = { textAlign: 'left' } satisfies CSSProperties

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
          + Add from your Hangar
        </Button>
      </div>
      <ModalShell
        open={open}
        onOpenChange={setOpen}
        title="Add from your Hangar"
        description={`Choose one of your units to move into ${here}.`}
        width="narrow"
      >
        <div style={BODY}>
          {choices === null ? (
            <Pending label="your Hangar" />
          ) : all.length === 0 ? (
            <Text variant="hint" style={HINT}>
              Nothing in your Hangar can move into {here}. Create a unit for it from the roster.
            </Text>
          ) : (
            <RadioCardGroup label={`Move into ${here}`} style={GROUPS}>
              {HANGAR_GROUPS.filter((g) => choices[g.kind].length > 0).map((group) => (
                <section key={group.kind} style={GROUP} aria-label={group.title}>
                  <Slab as="h3" label={group.title} />
                  {choices[group.kind].map((choice) => (
                    <Entity
                      key={key(choice)}
                      form="row"
                      model={unitRowModel({ kind: choice.kind, name: choice.name })}
                      mode={{
                        kind: 'select',
                        role: 'radio',
                        selected: key(choice) === picked,
                        onSelect: () => setPicked(key(choice)),
                        label: choice.name,
                      }}
                      {...(choice.relations.length > 0
                        ? {
                            relations: choice.relations.map((r) =>
                              relation(r.key, r.label, r.value, { href: r.href })
                            ),
                          }
                        : {})}
                    />
                  ))}
                </section>
              ))}
            </RadioCardGroup>
          )}
          <DialogActions>
            <Button variant="ghost" size="compact" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="compact"
              disabled={chosen === null}
              onClick={() => chosen && add(chosen)}
            >
              {chosen === null ? 'Move in' : `Move ${chosen.name} in`}
            </Button>
          </DialogActions>
        </div>
      </ModalShell>
    </>
  )
}

/** A choice's radio value: kinds share no ids, but say which anyway. */
function key(choice: Pick<HangarChoice, 'kind' | 'id'>): string {
  return `${choice.kind}:${choice.id}`
}
