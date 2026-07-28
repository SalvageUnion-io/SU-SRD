import { useState } from 'react'
import { Button, Card, Text } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { SignInControl } from '../account/SignInControl'

/**
 * Games: create one, invite people, join by code, hand over the Organizer role.
 *
 * The whole screen is gated on `mode === 'connected'`. That is not defensive
 * coding — a Game is inherently shared state, so there is nothing meaningful to
 * show a Solo user and nothing safe to show a Disconnected one, whose view
 * would be a stale snapshot of a roster that may have changed.
 */

const label = 'font-cond text-xs font-bold tracking-caps-wide uppercase'

function InvitePanel({ gameId }: { gameId: Id<'games'> }) {
  const createInvite = useMutation(api.invites.create)
  const [code, setCode] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        size="compact"
        onClick={() => void createInvite({ gameId }).then(setCode)}
      >
        Create invite code
      </Button>
      {code !== null && (
        <div className="flex flex-col gap-1">
          {/* Crockford base32 with no I/L/O/U, so a code read aloud across a
              table cannot be mistyped into a different valid one. Rendered
              large and spaced because reading it aloud is the primary use. */}
          <Text as="span" className="font-cond text-2xl font-bold tracking-caps-wide">
            {code}
          </Text>
          <Text variant="hint" className="text-left">
            Valid for 14 days. Anyone with this code can join as a player.
          </Text>
        </div>
      )}
    </div>
  )
}

function GameRow({
  game,
}: {
  game: {
    _id: Id<'games'>
    name: string
    mediator: boolean
    organizer: boolean
    memberCount: number
  }
}) {
  const members = useQuery(api.games.members, { gameId: game._id })
  const rename = useMutation(api.games.rename)
  const setMediator = useMutation(api.games.setMediator)
  const transferOrganizer = useMutation(api.games.transferOrganizer)
  const [name, setName] = useState<string | null>(null)

  const value = name ?? game.name

  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <Text as="span" className="font-cond text-lg font-bold">
            {game.name}
          </Text>
          <Text variant="hint" className="text-left">
            {game.organizer ? 'Organizer · ' : ''}
            {game.mediator ? 'Mediator' : 'Player'}
          </Text>
        </div>

        {game.organizer && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className={label}>Name</span>
              <input
                aria-label={`Rename ${game.name}`}
                className="border-2 border-[var(--color-ink)] bg-[var(--color-paper)] px-2 py-1"
                value={value}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <Button
              variant="primary"
              size="compact"
              onClick={() => void rename({ gameId: game._id, name: value })}
            >
              Save
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <span className={label}>Crew</span>
          {members === undefined && <Text variant="hint">Loading…</Text>}
          {members?.map((m) => (
            <div key={m.userId} className="flex items-baseline justify-between gap-3">
              <Text as="span">{m.displayName}</Text>
              <span className="flex items-center gap-2">
                <Text variant="hint" className="text-left">
                  {m.organizer ? 'Organizer · ' : ''}
                  {m.mediator ? 'Mediator' : 'Player'}
                </Text>
                {game.organizer && (
                  <>
                    <Button
                      variant="ghost"
                      size="mini"
                      onClick={() =>
                        void setMediator({
                          gameId: game._id,
                          userId: m.userId,
                          mediator: !m.mediator,
                        })
                      }
                    >
                      {m.mediator ? 'Stand down' : 'Make Mediator'}
                    </Button>
                    {!m.organizer && (
                      <Button
                        variant="ghost"
                        size="mini"
                        onClick={() =>
                          void transferOrganizer({ gameId: game._id, userId: m.userId })
                        }
                      >
                        Hand over
                      </Button>
                    )}
                  </>
                )}
              </span>
            </div>
          ))}
        </div>

        {game.organizer && <InvitePanel gameId={game._id} />}
      </div>
    </Card>
  )
}

function ConnectedGames() {
  const games = useQuery(api.games.listMine, {})
  const create = useMutation(api.games.create)
  const redeem = useMutation(api.invites.redeem)

  const [newName, setNewName] = useState('')
  const [code, setCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-end gap-2 p-4">
          <label className="flex flex-col gap-1">
            <span className={label}>Start a game</span>
            <input
              aria-label="New game name"
              placeholder="Union Crawler #430"
              className="border-2 border-[var(--color-ink)] bg-[var(--color-paper)] px-2 py-1"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <Button
            variant="primary"
            size="compact"
            disabled={newName.trim().length === 0}
            onClick={() => void create({ name: newName }).then(() => setNewName(''))}
          >
            Create
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className={label}>Join with a code</span>
              <input
                aria-label="Invite code"
                placeholder="A1B2C3D4"
                className="border-2 border-[var(--color-ink)] bg-[var(--color-paper)] px-2 py-1 tracking-caps-wide uppercase"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <Button
              variant="primary"
              size="compact"
              disabled={code.trim().length === 0}
              onClick={() => {
                setJoinError(null)
                void redeem({ code })
                  .then(() => setCode(''))
                  // The server distinguishes not-valid / expired / used-up, so
                  // surface its wording rather than a generic failure.
                  .catch((err: Error) => setJoinError(err.message))
              }}
            >
              Join
            </Button>
          </div>
          {joinError !== null && (
            <Text variant="hint" className="text-left text-[var(--color-roll-cascade)]">
              {joinError}
            </Text>
          )}
        </div>
      </Card>

      {games === undefined && <Text>Loading your games…</Text>}
      {games?.length === 0 && (
        <Text variant="hint" className="text-left">
          You are not in any games yet. Create one, or join with a code from whoever set yours up.
        </Text>
      )}
      {games?.map((g) => (
        <GameRow key={g._id} game={g} />
      ))}
    </div>
  )
}

function GamesBody() {
  const { mode } = useConnection()

  if (mode === 'connected') return <ConnectedGames />

  if (mode === 'disconnected') {
    return (
      <Card>
        <div className="p-4">
          <Text>
            Your games are unreachable right now. Reconnect to see your crew or manage invites.
          </Text>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <Text>Games let several people share one crawler, with a Mediator running the table.</Text>
        <Text variant="hint" className="text-left">
          You are playing solo. Everything you build stays on this device and needs no account —
          sign in only if you want to play with other people.
        </Text>
        <div>
          <SignInControl />
        </div>
      </div>
    </Card>
  )
}

export function GamesScreen() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <Text as="h1" className="font-cond text-2xl font-bold tracking-caps uppercase">
        Games
      </Text>
      {isConvexConfigured ? (
        <GamesBody />
      ) : (
        <Card>
          <div className="p-4">
            <Text>
              This build has no account service configured, so shared games are unavailable and
              everything is saved on this device.
            </Text>
          </div>
        </Card>
      )}
    </main>
  )
}
