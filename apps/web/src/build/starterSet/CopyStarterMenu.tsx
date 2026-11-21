/**
 * "Make a copy" of one Starter Set build, wherever it is offered: the sheet's
 * band action (`MakeACopy`) and each line of the Starter Set page. One name
 * for one act, and one confirm that names where the copy goes.
 *
 * A player with nowhere to copy to but the Training Bay gets a button; one in a
 * Game gets the same words as a menu of where (the Training Bay, or one of
 * their Games), then the same confirm. A pilot brings the mech their book
 * pairs them with, already assigned (`copyStarterPilot`), and the confirm says
 * so. Confirmed, the player lands on the copy.
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

import { SHELF } from 'game-domain/container'
import type { SheetKind } from 'game-domain/entityKinds'
import { sheetPath } from 'game-domain/entityKinds'
import { Button, HeaderMenu, toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { useGo } from '../../components/shared/useGo'
import { moveDestinations } from '../../lib/games/gameRoster'
import { copyStarter, copyStarterPilot, starterMechOf } from '../../lib/starterSet/copyStarter'
import {
  rosterOf,
  STARTER_SET_PUBLISHER,
  starterRoster,
} from '../../lib/starterSet/starterTemplates'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
import { useGamesQuery } from '../../replica/roomCalls'
import { useSync } from '../../replica/syncContext'
import { serializeContainer } from '../entityContainer/containerKey.model'

type CopyStarterMenuProps = {
  kind: SheetKind
  templateId: string
  name: string
  /** Opens the confirm. Owned by an ancestor that outlives the control. */
  confirm: Confirm
  /** The sheet's one action is `full`; a line of the Starter Set page keeps `mini`. */
  size?: 'mini' | 'full'
  className?: string
}

type Destination = ReturnType<typeof moveDestinations>[number]

function ConnectedCopyStarterMenu({
  kind,
  templateId,
  name,
  confirm,
  size = 'mini',
  className,
}: CopyStarterMenuProps) {
  const games = useGamesQuery('games.listMine', {})
  const go = useGo()
  const destinations = moveDestinations({ kind, current: SHELF, games: games ?? [] })
  // A pilot's copy is the pair the page lists: the pilot and their mech.
  const mech = kind === 'pilot' ? starterMechOf(templateId) : null
  const what = mech === null ? name : buildStarterSetCopy('pilotAndMech', { name, mech: mech.name })

  function copyTo(target: Destination) {
    const to = target.container
    // "your Training Bay" in a sentence (glossary §2); a Game by its name.
    const where = to.kind === 'shelf' ? buildStarterSetCopy('yourTrainingBay') : target.label
    confirm({
      title: buildStarterSetCopy('copyTo', { name: what, label: where }),
      body: [
        mech === null
          ? buildStarterSetCopy('copyBody', { name, label: where })
          : buildStarterSetCopy('copyPairBody', { name, mech: mech.name, label: where }),
        buildStarterSetCopy('staysAsPublished', {
          roster: (rosterOf(templateId) ?? starterRoster('starter-set')).name,
          name,
          publisher: STARTER_SET_PUBLISHER,
        }),
      ],
      confirmLabel: buildStarterSetCopy('makeACopy'),
      pendingLabel: buildStarterSetCopy('copying'),
      tone: 'default',
      failure: buildStarterSetCopy('notCopied', { name }),
      onConfirm: async () => {
        const made =
          kind === 'pilot'
            ? await copyStarterPilot(templateId, to)
            : await copyStarter(kind, templateId, to)
        toast.success(buildStarterSetCopy('copiedTo', { name: what, label: where }))
        // Land on the copy: it is the build they came for.
        go(sheetPath(kind, made.id))
      },
    })
  }

  const label = buildStarterSetCopy('makeACopy')
  // On a page of builds each control names its own; the sheet's is the only one.
  const named = size === 'mini' ? buildStarterSetCopy('makeACopyOfName', { name }) : undefined
  const [only] = destinations
  if (destinations.length === 1 && only !== undefined) {
    return (
      <Button
        variant={size === 'full' ? 'primary' : 'default'}
        size={size}
        className={className}
        aria-label={named}
        onClick={() => copyTo(only)}
      >
        {label}
      </Button>
    )
  }
  return (
    <HeaderMenu
      variant="button"
      size={size}
      className={className}
      trigger={label}
      label={named ?? label}
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
  const { status } = useSync()
  if (status !== 'live') return null
  return <ConnectedCopyStarterMenu {...props} />
}
