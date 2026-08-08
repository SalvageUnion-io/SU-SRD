/**
 * MediatorPanel — appoint or stand down the table's Mediator. Organizer only.
 *
 * ## Why this exists
 *
 * `games.create` seats its creator as Organizer with `mediator: false`, on the
 * documented reasoning that "many tables decide who runs it after the Game
 * exists". `games.setMediator` is the only mutation that flips that flag — and
 * until this panel, **its only callers were tests.**
 *
 * The consequence was a lockout rather than a missing nicety. `MediatorScreen`
 * hard-gates on `mediator.amMediator`, and `GameScreen`'s only link to
 * `/mediator/:id` is conditional on the viewer already holding the flag, so
 * nothing in the app could ever set it. The remaining route in — a
 * `role: 'mediator'` invite — short-circuits for existing members
 * (`invites.redeem` returns `already` when a membership exists), and the
 * Organizer is by construction already a member of their own Game. A solo
 * organizer therefore needed a **second signed-in account** to mint them a
 * mediator invite before the GM surface existed at all.
 *
 * So this is deliberately a roster of every member rather than a single
 * "make me the Mediator" button: the flag is per-membership and the Organizer
 * is often not the person running the session.
 */

import { Badge, Button, Card, Text } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { ConvexPending } from '../shared/ConvexPending'

export function MediatorPanel({ gameId }: { gameId: Id<'games'> }) {
  const members = useQuery(api.games.members, { gameId })
  const setMediator = useMutation(api.games.setMediator)

  if (members === undefined) return <ConvexPending label="the crew" />

  return (
    <Card
      headerBg="bg-ink"
      headerContent={
        <Badge shape="stamp" as="h2" size="full">
          Who mediates
        </Badge>
      }
    >
      <div className="flex flex-col gap-3 p-4">
        <Text>
          The Mediator runs the session — they get the opposition tray, the answer queue and the
          table's Downtime controls. Anyone at the table can hold it, including you.
        </Text>
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Text>{m.displayName}</Text>
                {m.organizer ? <Badge surface="quiet">Organizer</Badge> : null}
                {m.mediator ? <Badge surface="solid">Mediator</Badge> : null}
              </span>
              <Button
                variant={m.mediator ? 'ghost' : 'default'}
                size="mini"
                onClick={() => {
                  void setMediator({ gameId, userId: m.userId, mediator: !m.mediator })
                }}
              >
                {m.mediator ? 'Stand down' : 'Make Mediator'}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
