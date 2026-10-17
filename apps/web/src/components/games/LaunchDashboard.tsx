/**
 * LaunchDashboard — a player's way into the Dashboard: a chip button in the
 * Game band (`GameBand`'s `actions`), and a dialog that asks which pilot to
 * play (ADR-038 §1). The Mediator's Launch Dashboard chip is the band's own
 * link to the Mediator dashboard instead.
 *
 * The Dashboard is keyed on a pilot in a Game with a Mediator, so the place to
 * launch it is the Game itself — the hub `/` shows once a Game is picked — not
 * a row on its roster or a live sheet. The button is always there; without a
 * Mediator there is nothing to launch, and the dialog says so.
 *
 * ## One choice: the pilot
 *
 * The dialog lists the Game's pilots — each its Row in select mode (EDL
 * "Modes"), who holds it right of the name — in the roster's own order: yours first
 * (`groupColumn`), then the crew's — and pre-selects the first one you own. A
 * viewer who owns none of those listed gets no pre-selection and picks one.
 * Nothing else is asked: the mech and the crawler follow from the pilot's own
 * assignments once the Dashboard opens.
 *
 * ## Only pilots this browser holds
 *
 * It lists only the Game's pilots this browser holds a copy of, because those
 * are the only ones the Dashboard can open: `DashboardGate` and `Dashboard`
 * read the pilot from the local store, which never holds a crewmate's pilot
 * (`SheetView`'s header says why). Offering a crewmate's pilot, or a pre-gen
 * this browser never made, would send every such choice to the gate's "Pilot
 * not found". Those stay on the roster, where their read-only sheets open. A
 * viewer who holds none of the Game's pilots — a Mediator who plays nobody,
 * say — gets a line saying so instead of a choice.
 *
 * Connected only: `GameHub` mounts it, and `Roster` mounts the hub only when
 * the mode is Connected, so every hook below has a provider.
 */

import { useRouter } from '@tanstack/react-router'
import { hasMediator } from 'cantina-domain/games/roles'
import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useHydrateEntities, usePilots } from '../../lib/entities'
import type { RosterRow } from '../../lib/games/gameRoster'
import { groupColumn, ownableRows } from '../../lib/games/gameRoster'
import { unitRowModel } from '../../lib/units/unitModel'
import { Button, DialogActions, Entity, ModalShell, RadioCardGroup, Text, tokens } from '../index'
import { OwnerSeal } from './OwnerSeal'

const HINT = { textAlign: 'left' } satisfies CSSProperties

const BODY = {
  backgroundColor: tokens.color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  padding: tokens.space[20],
} satisfies CSSProperties

const FIELDSET = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  minWidth: 0,
} satisfies CSSProperties

const LEGEND = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  margin: 0,
  marginBottom: tokens.space[8],
} satisfies CSSProperties

/** The pilots, each its Row in select mode, 8px apart. */
const CHOICES = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
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
  // The player's own pick. Until they make one, the selection follows
  // `preselect`, so a listing that answers after the picker opened still
  // arrives with their pilot chosen.
  const [picked, setPicked] = useState<string | null>(null)

  // The same three questions `GameRoster` asks, so Convex answers both from
  // one subscription each.
  const me = useQuery(api.account.me, {})
  const members = useQuery(api.games.members, { gameId: gameId as Id<'games'> })
  const listing = useQuery(api.entities.listForGame, { gameId: gameId as Id<'games'> })
  // What this browser holds decides what may be offered: see the header.
  useHydrateEntities(['pilot'])
  const localPilots = usePilots()

  // Nothing until the crew is known: a button that appears and then vanishes
  // when the members answer would be worse than a beat of nothing.
  if (members === undefined) return null
  // No Mediator, no Dashboard: the button stays, and the dialog says why.
  const mediated = hasMediator(members)

  const { yours, others } = groupColumn(
    ownableRows({
      kind: 'pilot',
      rows: listing?.pilots ?? [],
      viewerId: me?._id ?? null,
      members,
      localIds: new Set(localPilots.map((p) => p.id)),
    }).filter((row) => row.localId !== null)
  )
  const pilots = [...yours, ...others]
  const selected = picked ?? preselect(pilots)
  const chosen = pilots.find((row) => row.serverId === selected) ?? null

  function openPicker() {
    setPicked(null)
    setOpen(true)
  }

  function launch() {
    if (!mediated) return
    if (chosen?.localId == null) return
    setOpen(false)
    // The local id: the one `DashboardGate` looks the pilot up by.
    void router?.navigate({ to: '/dashboard/$pilotId', params: { pilotId: chosen.localId } })
  }

  return (
    <>
      <Button variant="primary" size="compact" onClick={openPicker}>
        Launch Dashboard
      </Button>
      <ModalShell
        open={open}
        onOpenChange={setOpen}
        title="Launch Dashboard"
        description="Choose the pilot to play."
      >
        <div style={BODY}>
          {!mediated ? (
            <Text variant="hint" style={HINT}>
              The Dashboard runs once this Game has a Mediator. The Organizer appoints one under The
              Game.
            </Text>
          ) : listing === undefined ? (
            <Text variant="hint" style={HINT}>
              Loading pilots…
            </Text>
          ) : pilots.length === 0 ? (
            <Text variant="hint" style={HINT}>
              None of this Game's pilots is saved in this browser. Create or claim one from the
              roster, then launch.
            </Text>
          ) : (
            <div style={FIELDSET}>
              <p style={LEGEND}>Which pilot are you playing?</p>
              <RadioCardGroup label="Which pilot are you playing?" style={CHOICES}>
                {pilots.map((row) => (
                  <Entity
                    key={row.serverId}
                    form="row"
                    model={unitRowModel({ kind: 'pilot', name: row.name })}
                    mode={{
                      kind: 'select',
                      role: 'radio',
                      selected: row.serverId === selected,
                      onSelect: () => setPicked(row.serverId),
                      label: row.name,
                    }}
                    /* Who holds it, right of the name (ruleset §7.2), as the roster says it. */
                    labels={
                      row.owner === null ? undefined : (
                        <OwnerSeal
                          owner={row.owner}
                          claimable={false}
                          disabled
                          onClaim={() => undefined}
                        />
                      )
                    }
                  />
                ))}
              </RadioCardGroup>
            </div>
          )}
          <DialogActions>
            <Button variant="ghost" size="compact" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="compact"
              disabled={!mediated || chosen === null}
              onClick={launch}
            >
              Launch
            </Button>
          </DialogActions>
        </div>
      </ModalShell>
    </>
  )
}
