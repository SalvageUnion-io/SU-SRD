/**
 * LaunchDashboard — the one way into the Dashboard: a button at the top of the
 * Game hub, and a dialog that asks which pilot to play (ADR-038 §1).
 *
 * The Dashboard is keyed on a pilot in a Game with a Mediator, so the place to
 * launch it is the Game itself — the hub `/` shows once a Game is picked — not
 * a row on its roster or a live sheet. Players and the Mediator alike get the
 * same button while the Game has a Mediator; without one there is nothing to
 * launch, and the hub says so in a line rather than offering a refusal.
 *
 * ## One choice: the pilot
 *
 * The dialog lists the Game's pilots in the roster's own order — yours first
 * (`groupColumn`), then the crew's — and pre-selects the first one you own. A
 * viewer who owns none (a Mediator, say) gets no pre-selection and picks one.
 * Nothing else is asked: the mech and the crawler follow from the pilot's own
 * assignments once the Dashboard opens.
 *
 * A crewmate's pilot is offered too. Whether it may open is `DashboardGate`'s
 * question, asked live on arrival, and the server refuses every write the
 * viewer may not make, whatever this lists.
 *
 * Connected only: `GameHub` mounts it, and `Roster` mounts the hub only when
 * the mode is Connected, so every hook below has a provider.
 */

import { useRouter } from '@tanstack/react-router'
import { Button, ModalShell, Radio, Text, tokens } from 'component-lib'
import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { RosterRow } from '../../lib/games/gameRoster'
import {
  gameHasMediator,
  groupColumn,
  ownableRows,
  rosterEntityId,
} from '../../lib/games/gameRoster'

const BAR = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
  marginTop: tokens.space[16],
} satisfies CSSProperties

const HINT = { textAlign: 'left' } satisfies CSSProperties

const BODY = {
  backgroundColor: tokens.color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  padding: tokens.space[20],
} satisfies CSSProperties

const FIELDSET = {
  border: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  margin: 0,
  minWidth: 0,
  padding: 0,
} satisfies CSSProperties

const LEGEND = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  marginBottom: tokens.space[8],
  padding: 0,
} satisfies CSSProperties

const ACTIONS = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  justifyContent: 'flex-end',
} satisfies CSSProperties

/** The pilot a viewer is offered first: their own, in the roster's order. */
function preselect(pilots: readonly RosterRow[]): string | null {
  return pilots.find((row) => row.owner?.mine === true)?.serverId ?? null
}

export function LaunchDashboard({ gameId }: { gameId: string }) {
  // Probed rather than required, as `GameRoster` and `AppLink` do: component
  // tests render the hub without a RouterProvider.
  const router = useRouter({ warn: false })
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  // The same three questions `GameRoster` asks, so Convex answers both from
  // one subscription each.
  const me = useQuery(api.account.me, {})
  const members = useQuery(api.games.members, { gameId: gameId as Id<'games'> })
  const listing = useQuery(api.entities.listForGame, { gameId: gameId as Id<'games'> })

  // Nothing until the crew is known: a button that appears and then vanishes
  // when the members answer would be worse than a beat of nothing.
  if (members === undefined) return null
  if (!gameHasMediator(members)) {
    return (
      <div style={BAR}>
        <Text variant="hint" style={HINT}>
          The Dashboard opens once this Game has a Mediator.
        </Text>
      </div>
    )
  }

  const { yours, others } = groupColumn(
    ownableRows({
      kind: 'pilot',
      rows: listing?.pilots ?? [],
      viewerId: me?._id ?? null,
      members,
      // Not asked: the dialog opens nothing itself, so whether this browser
      // holds a copy yet is the Dashboard's concern, not the picker's.
      localIds: new Set(),
    })
  )
  const pilots = [...yours, ...others]
  const chosen = pilots.find((row) => row.serverId === selected) ?? null

  function openPicker() {
    setSelected(preselect(pilots))
    setOpen(true)
  }

  function launch() {
    if (chosen === null) return
    setOpen(false)
    void router?.navigate({
      to: '/dashboard/$pilotId',
      params: { pilotId: rosterEntityId(chosen) },
    })
  }

  return (
    <div style={BAR}>
      <Button variant="primary" size="full" onClick={openPicker}>
        Launch Dashboard
      </Button>
      <ModalShell
        open={open}
        onOpenChange={setOpen}
        title="Launch Dashboard"
        description="Choose the pilot to play."
      >
        <div style={BODY}>
          {pilots.length === 0 ? (
            <Text variant="hint" style={HINT}>
              No pilots in this game yet. Create one from the roster, then launch.
            </Text>
          ) : (
            <fieldset style={FIELDSET}>
              <legend style={LEGEND}>Which pilot are you playing?</legend>
              {pilots.map((row) => (
                <Radio
                  key={row.serverId}
                  name={`launch-pilot-${gameId}`}
                  value={row.serverId}
                  checked={row.serverId === selected}
                  onChange={() => setSelected(row.serverId)}
                  label={row.name}
                  description={row.owner?.label}
                />
              ))}
            </fieldset>
          )}
          <div style={ACTIONS}>
            <Button variant="ghost" size="compact" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="compact" disabled={chosen === null} onClick={launch}>
              Launch
            </Button>
          </div>
        </div>
      </ModalShell>
    </div>
  )
}
