/**
 * "Make a copy" of one Starter Set build, wherever it is offered: the sheet's
 * band action (`MakeACopy`) and each line of the Starter Set page. One name
 * for one act, and it copies at once (r5 B18): nothing is lost by copying, so
 * its notice carries an Undo rather than a confirm asking first.
 *
 * A player with nowhere to copy to but the Training Bay gets a button; one in a
 * Game gets the same words as a menu of where (the Training Bay, or one of
 * their Games). A pilot brings the mech their book pairs them with, already
 * assigned (`copyStarterPilot`), and the notice names both. The player lands
 * on the copy, in Sheet mode: a fresh copy is read before it is edited (r5 C13).
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
import { useState } from 'react'
import { Button, HeaderMenu, toast } from '../../components/index'
import { useGo } from '../../components/shared/useGo'
import { failureMessage } from '../../lib/connection/useServerAction'
import { moveDestinations } from '../../lib/games/gameRoster'
import {
  copyStarter,
  copyStarterPilot,
  starterMechOf,
  undoCopies,
} from '../../lib/starterSet/copyStarter'
import {
  rosterOf,
  STARTER_SET_PUBLISHER,
  starterRoster,
} from '../../lib/starterSet/starterTemplates'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
import { useGamesQuery } from '../../replica/roomCalls'
import { useSync } from '../../replica/syncContext'
import { serializeContainer } from '../entityContainer/containerKey.model'
import { useSheetModeStore } from '../sheet/sheetMode.model'

type CopyStarterMenuProps = {
  kind: SheetKind
  templateId: string
  name: string
  /** The sheet's one action is `full`; a line of the Starter Set page keeps `mini`. */
  size?: 'mini' | 'full'
  className?: string
}

type Destination = ReturnType<typeof moveDestinations>[number]

function ConnectedCopyStarterMenu({
  kind,
  templateId,
  name,
  size = 'mini',
  className,
}: CopyStarterMenuProps) {
  const games = useGamesQuery('games.listMine', {})
  const go = useGo()
  const [copying, setCopying] = useState(false)
  const destinations = moveDestinations({ kind, current: SHELF, games: games ?? [] })
  // A pilot's copy is the pair the page lists: the pilot and their mech.
  const mech = kind === 'pilot' ? starterMechOf(templateId) : null
  const what = mech === null ? name : buildStarterSetCopy('pilotAndMech', { name, mech: mech.name })

  async function copyTo(target: Destination) {
    const to = target.container
    // "your Training Bay" in a sentence (glossary §2); a Game by its name.
    const where = to.kind === 'shelf' ? buildStarterSetCopy('yourTrainingBay') : target.label
    setCopying(true)
    try {
      const copy =
        kind === 'pilot'
          ? await copyStarterPilot(templateId, to)
          : { ...(await copyStarter(kind, templateId, to)), mech: null }
      const made = [
        { kind, id: copy.id },
        ...(copy.mech === null ? [] : [{ kind: 'mech' as const, id: copy.mech.id }]),
      ]
      toast.success(buildStarterSetCopy('copiedTo', { name: what, label: where }), {
        description: buildStarterSetCopy('staysAsPublished', {
          roster: (rosterOf(templateId) ?? starterRoster('starter-set')).name,
          name,
          publisher: STARTER_SET_PUBLISHER,
        }),
        action: {
          label: buildStarterSetCopy('undo'),
          onClick: () => void undoCopy(made, copy.id),
        },
      })
      // Land on the copy, in Sheet mode: it is the build they came for.
      useSheetModeStore.getState().setEditing(false)
      go(sheetPath(kind, copy.id))
    } catch (err) {
      toast.error(failureMessage(err, buildStarterSetCopy('notCopied', { name })))
    } finally {
      setCopying(false)
    }
  }

  /** Take the copy away again, and step back off its sheet where the copy opened it. */
  async function undoCopy(made: { kind: SheetKind; id: string }[], id: string) {
    await undoCopies(made)
    toast.success(buildStarterSetCopy('copyUndone', { name: what }))
    if (window.location.pathname.endsWith(`/${id}`)) window.history.back()
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
        disabled={copying}
        onClick={() => void copyTo(only)}
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
      disabled={copying}
      sections={[
        destinations.map((d) => ({
          id: serializeContainer(d.container),
          label: d.label,
          onSelect: () => void copyTo(d),
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
