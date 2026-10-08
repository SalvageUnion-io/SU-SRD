/**
 * "Copy to…" on a Starter Set row or sheet: the player picks where the copy
 * goes — My Stuff, or one of their Games — and confirms.
 *
 * The destinations are the ones a build of that kind may be **moved** to
 * (`moveDestinations`, which mirrors the server's ADR-037 rules): a pilot or
 * mech into My Stuff or any Game the player belongs to, a crawler into My Stuff
 * or a Game they run. A copy lands exactly where a move could have put it, so
 * the server accepts it for the same reasons.
 *
 * Connected only. Signed out the control is absent and the surface says to sign
 * in: a copy is a write, and building needs an account (ADR-034 as amended).
 */

import { Select, toast, tokens } from 'component-lib'
import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { SHELF } from '../../lib/container'
import { moveDestinations } from '../../lib/games/gameRoster'
import type { StarterKind } from '../../lib/starterSet/copyStarter'
import { copyStarter, STARTER_SET_PUBLISHER } from '../../lib/starterSet/copyStarter'
import { serializeContainer } from '../../stores/activeContainerStore'
import type { Confirm } from '../shared/useConfirm'

type CopyStarterSelectProps = {
  kind: StarterKind
  templateId: string
  name: string
  /** Opens the confirm. Owned by an ancestor that outlives the control. */
  confirm: Confirm
}

/** The placeholder's value: "no destination chosen". Never a real container. */
const NONE = ''

// Matches MoveToGameSelect: the row's controls are `mini`, so the select takes
// their height and type rather than the 44px form-field default.
const SELECT = {
  fontSize: tokens.fontSize.xs,
  minHeight: 0,
  padding: `3px ${tokens.space[8]}`,
  width: 'auto',
} satisfies CSSProperties

function ConnectedCopyStarterSelect({ kind, templateId, name, confirm }: CopyStarterSelectProps) {
  const games = useQuery(api.games.listMine)
  const destinations = moveDestinations({ kind, current: SHELF, games: games ?? [] })

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const target = destinations.find((d) => serializeContainer(d.container) === e.target.value)
    if (target === undefined) return
    // Read now: the event is long gone by the time the confirm is answered.
    const to = target.container
    confirm({
      title: `Copy ${name} to ${target.label}?`,
      body: [
        `This makes ${name} a build of your own in ${target.label}, to edit and play.`,
        `The Starter Set's ${name} stays as ${STARTER_SET_PUBLISHER} published it. Don't want the copy later? Delete it like any other build.`,
      ],
      confirmLabel: 'Make a copy',
      pendingLabel: 'Copying…',
      tone: 'default',
      failure: `${name} could not be copied. Try again.`,
      onConfirm: async () => {
        await copyStarter(kind, templateId, to)
        toast.success(`Copied ${name} to ${target.label}.`)
      },
    })
  }

  return (
    <Select value={NONE} onChange={handleChange} aria-label={`Copy ${name} to…`} style={SELECT}>
      <option value={NONE} disabled>
        Copy to…
      </option>
      {destinations.map((d) => (
        <option key={serializeContainer(d.container)} value={serializeContainer(d.container)}>
          {d.label}
        </option>
      ))}
    </Select>
  )
}

export function CopyStarterSelect(props: CopyStarterSelectProps) {
  const { mode } = useConnection()
  if (mode !== 'connected') return null
  return <ConnectedCopyStarterSelect {...props} />
}
