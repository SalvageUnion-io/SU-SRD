/**
 * "Copy to…" on a Starter Set Compact: a Mini action chip in the Compact's last slot
 * (C8, hard rule R6) that opens a menu (`HeaderMenu`) of where the copy may
 * go — the Training Bay, or one of the player's Games — and confirms.
 *
 * The destinations are the ones a build of that kind may be **moved** to
 * (`moveDestinations`, which mirrors the server's ADR-037 rules): a pilot or
 * mech into your shelves or any Game the player belongs to, a crawler into your shelves
 * or a Game they run. A copy lands exactly where a move could have put it, so
 * the server accepts it for the same reasons.
 *
 * Connected only. Signed out the control is absent and the surface says to sign
 * in: a copy is a write, and building needs an account (ADR-034 as amended).
 */

import { useQuery } from 'convex/react'
import { SHELF } from 'game-domain/container'
import type { SheetKind } from 'game-domain/entityKinds'
import { api } from '../../../convex/_generated/api'
import { HeaderMenu, toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { useConnection } from '../../lib/connection/connectionContext'
import { moveDestinations } from '../../lib/games/gameRoster'
import { copyStarter } from '../../lib/starterSet/copyStarter'
import { STARTER_SET_PUBLISHER } from '../../lib/starterSet/starterTemplates'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
import { serializeContainer } from '../entityContainer/containerKey.model'

type CopyStarterMenuProps = {
  kind: SheetKind
  templateId: string
  name: string
  /** Opens the confirm. Owned by an ancestor that outlives the control. */
  confirm: Confirm
}

type Destination = ReturnType<typeof moveDestinations>[number]

function ConnectedCopyStarterMenu({ kind, templateId, name, confirm }: CopyStarterMenuProps) {
  const games = useQuery(api.games.listMine)
  const destinations = moveDestinations({ kind, current: SHELF, games: games ?? [] })

  function copyTo(target: Destination) {
    const to = target.container
    confirm({
      title: buildStarterSetCopy('copyTo', { name, label: target.label }),
      body: [
        `This makes ${name} a build of your own in ${target.label}, to edit and play.`,
        `The Starter Set's ${name} stays as ${STARTER_SET_PUBLISHER} published it. Don't want the copy later? Delete it like any other build.`,
      ],
      confirmLabel: buildStarterSetCopy('makeACopy'),
      pendingLabel: buildStarterSetCopy('copying'),
      tone: 'default',
      failure: `${name} could not be copied. Try again.`,
      onConfirm: async () => {
        await copyStarter(kind, templateId, to)
        toast.success(buildStarterSetCopy('copiedTo', { name, label: target.label }))
      },
    })
  }

  return (
    <HeaderMenu
      variant="button"
      size="mini"
      trigger="Copy to…"
      label={buildStarterSetCopy('copyTo2', { name })}
      sections={[
        destinations.map((d) => ({
          id: serializeContainer(d.container),
          label: d.label,
          onSelect: () => copyTo(d),
        })),
      ]}
    />
  )
}

export function CopyStarterMenu(props: CopyStarterMenuProps) {
  const { mode } = useConnection()
  if (mode !== 'connected') return null
  return <ConnectedCopyStarterMenu {...props} />
}
